import { createSession, ping, TARGET_REPO } from "@/lib/trueforge/client";
import { auditPrompt, auditSpec } from "@/lib/trueforge/agent-spec";
import { errorStream, turnStream } from "@/lib/trueforge/route-helpers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * POST /api/agent/run — start the audit.
 * Creates a TrueForge session and streams the first turn's mapped events
 * (SSE). Body: `{ repo?: string }` (defaults to GATEKEEPER_TARGET_REPO).
 */
export async function POST(request: Request) {
  const { repo = TARGET_REPO } = await request.json().catch(() => ({}) as { repo?: string });

  const health = await ping();
  if (!health.ok) return errorStream(health.detail ?? "TrueForge is unreachable.");

  let sessionId: string;
  try {
    sessionId = await createSession(auditSpec());
  } catch (err) {
    return errorStream(err instanceof Error ? err.message : "Could not create a TrueForge session.");
  }

  return turnStream(sessionId, [{ type: "user.message", content: auditPrompt(repo) }], "audit", [
    { kind: "session", sessionId },
    { kind: "phase", phase: "working" },
  ]);
}
