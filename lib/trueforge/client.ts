/**
 * Thin server-side client for the TrueForge HTTP API. Raw `fetch` — the surface
 * we touch is three endpoints, so an SDK would be more indirection than value.
 *
 * Only ever called from Route Handlers (`app/api/agent/*`). The browser never
 * talks to TrueForge directly: keeps CORS simple and the harness swappable.
 */

import type {
  AgentSpec,
  CreateSessionResponse,
  CreateTurnRequest,
  TurnInputItem,
  TurnStreamEvent,
} from "./types";

export const TRUEFORGE_URL = process.env.TRUEFORGE_URL ?? "http://localhost:8790";
export const TRUEFORGE_MODEL = process.env.TRUEFORGE_MODEL ?? "anthropic/claude-fable-5";
export const TARGET_REPO = process.env.GATEKEEPER_TARGET_REPO ?? "naviadepu/portfolio-navi-deploy";

const API = `${TRUEFORGE_URL}/api/v1`;

export class TrueForgeError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TrueForgeError";
  }
}

async function readError(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { error?: { message?: string } };
    return body.error?.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

/** Is TrueForge up and reachable? Used to give a clear error before a run starts. */
export async function ping(): Promise<{ ok: boolean; detail?: string }> {
  try {
    const res = await fetch(`${API}/auth/me`, { signal: AbortSignal.timeout(4000) });
    if (!res.ok) return { ok: false, detail: `TrueForge returned ${res.status}` };
    return { ok: true };
  } catch {
    return { ok: false, detail: `Can't reach TrueForge at ${TRUEFORGE_URL}. Is \`npx @truefoundry/trueforge\` running?` };
  }
}

export async function createSession(agent: AgentSpec): Promise<string> {
  const res = await fetch(`${API}/sessions`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ agent: { spec: agent } }),
  });
  if (!res.ok) throw new TrueForgeError(await readError(res), res.status);
  const body = (await res.json()) as CreateSessionResponse;
  return body.data.id;
}

export async function cancelSession(sessionId: string): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}/cancel`, { method: "POST" }).catch(() => {});
}

export async function deleteSession(sessionId: string): Promise<void> {
  await fetch(`${API}/sessions/${sessionId}`, { method: "DELETE" }).catch(() => {});
}

/**
 * Start (or resume) a turn and yield its SSE events as they arrive. The turn
 * ends when a `turn.done` event lands (terminal) or the stream closes.
 */
export async function* streamTurn(
  sessionId: string,
  input: TurnInputItem[],
  opts: { signal?: AbortSignal } = {},
): AsyncGenerator<TurnStreamEvent> {
  const payload: CreateTurnRequest = { input, previous_turn_id: "auto", stream: true };
  const res = await fetch(`${API}/sessions/${sessionId}/turns`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "text/event-stream" },
    body: JSON.stringify(payload),
    signal: opts.signal,
  });
  if (!res.ok || !res.body) {
    throw new TrueForgeError(await readError(res), res.status);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // SSE frames are separated by a blank line.
      let sep: number;
      while ((sep = buffer.indexOf("\n\n")) !== -1) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const data = frame
          .split("\n")
          .filter((l) => l.startsWith("data:"))
          .map((l) => l.slice(5).trim())
          .join("\n");
        if (!data || data === "[DONE]") continue;
        try {
          yield JSON.parse(data) as TurnStreamEvent;
        } catch {
          // ignore keep-alives / non-JSON comments
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
}
