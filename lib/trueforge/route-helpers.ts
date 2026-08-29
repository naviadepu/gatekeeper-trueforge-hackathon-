/**
 * Shared plumbing for the `app/api/agent/*` route handlers: turn TrueForge's
 * event stream into a mapped Server-Sent Events response for the browser.
 */

import { RunMapper } from "./mapper";
import { sse, type GkEvent } from "./protocol";
import { streamTurn, TrueForgeError } from "./client";
import type { TurnInputItem } from "./types";

const SSE_HEADERS = {
  "content-type": "text/event-stream; charset=utf-8",
  "cache-control": "no-cache, no-transform",
  connection: "keep-alive",
};

/**
 * Run one turn on `sessionId`, map its events, and stream them as SSE.
 * `prelude` events (e.g. the session id) are flushed before the turn starts.
 * The stream always ends with an `end` event.
 */
export function turnStream(
  sessionId: string,
  input: TurnInputItem[],
  mode: "audit" | "openpr",
  prelude: GkEvent[] = [],
): Response {
  const mapper = new RunMapper(mode);
  const encoder = new TextEncoder();

  const body = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (e: GkEvent) => controller.enqueue(encoder.encode(sse(e)));
      try {
        for (const e of prelude) send(e);
        for await (const raw of streamTurn(sessionId, input)) {
          for (const e of mapper.handle(raw)) send(e);
        }
      } catch (err) {
        const message =
          err instanceof TrueForgeError
            ? `TrueForge error (${err.status}): ${err.message}`
            : err instanceof Error
              ? err.message
              : "Unknown error talking to TrueForge.";
        send({ kind: "error", message });
      } finally {
        send({ kind: "end" });
        controller.close();
      }
    },
  });

  return new Response(body, { headers: SSE_HEADERS });
}

/** A one-shot SSE response carrying a single error, then `end`. */
export function errorStream(message: string): Response {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(sse({ kind: "error", message })));
      controller.enqueue(encoder.encode(sse({ kind: "end" })));
      controller.close();
    },
  });
  return new Response(body, { headers: SSE_HEADERS });
}
