import { createSession, ping, TARGET_REPO } from "@/lib/trueforge/client";
import { openPrPrompt, openPrSpec } from "@/lib/trueforge/agent-spec";
import { errorStream, turnStream } from "@/lib/trueforge/route-helpers";
import type { TurnInputItem } from "@/lib/trueforge/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

interface StartBody {
  step: "start";
  repo?: string;
  upgrades: Array<{ name: string; from: string; to: string }>;
}
interface ConfirmBody {
  step: "confirm";
  sessionId: string;
  threadId: string;
  toolCallId: string;
}
type Body = StartBody | ConfirmBody;

/**
 * POST /api/agent/approve — the human said yes.
 *
 * `step: "start"`   — human approved the selected upgrades. Opens a fresh
 *                     "open PR" session and streams its turn; it pauses at
 *                     `create_pull_request` and emits an `approval` event.
 * `step: "confirm"` — human confirmed the pending PR. Resumes that turn with
 *                     a tool approval so `create_pull_request` actually runs.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as Body | null;
  if (!body) return errorStream("Malformed request body.");

  const health = await ping();
  if (!health.ok) return errorStream(health.detail ?? "TrueForge is unreachable.");

  if (body.step === "start") {
    if (!Array.isArray(body.upgrades) || body.upgrades.length === 0) {
      return errorStream("No upgrades were selected.");
    }
    let sessionId: string;
    try {
      sessionId = await createSession(openPrSpec());
    } catch (err) {
      return errorStream(err instanceof Error ? err.message : "Could not create a TrueForge session.");
    }
    const prompt = openPrPrompt(body.repo ?? TARGET_REPO, body.upgrades);
    return turnStream(sessionId, [{ type: "user.message", content: prompt }], "openpr", [
      { kind: "session", sessionId },
      { kind: "phase", phase: "opening" },
    ]);
  }

  if (body.step === "confirm") {
    if (!body.sessionId || !body.threadId || !body.toolCallId) {
      return errorStream("Missing the pending pull-request reference.");
    }
    const resume: TurnInputItem = {
      type: "user.tool_approval",
      thread_id: body.threadId,
      tool_call_id: body.toolCallId,
      approval: { status: "allow" },
    };
    return turnStream(body.sessionId, [resume], "openpr", [{ kind: "phase", phase: "opening" }]);
  }

  return errorStream("Unknown approval step.");
}
