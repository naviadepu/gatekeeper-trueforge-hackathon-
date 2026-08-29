/**
 * The event protocol between Gatekeeper's own API routes (`app/api/agent/*`)
 * and the browser (`use-agent-run.ts`). A deliberately small, UI-shaped subset
 * of what TrueForge streams — the route handlers do the translation so the
 * client never has to know TrueForge's event vocabulary.
 */

import type { TraceStep, Upgrade } from "@/components/gatekeeper/data";

export type GkPhase =
  | "working" // audit turn running — trace filling in
  | "waiting" // audit done — ledger shown, waiting for the human to choose + approve
  | "confirming" // open-PR turn paused at create_pull_request — waiting for final confirm
  | "opening" // human confirmed — the PR call is running
  | "done" // PR opened
  | "declined"; // run cancelled

export type TraceRow = TraceStep & { status: "running" | "done" | "failed" };

export interface PendingPr {
  threadId: string;
  toolCallId: string;
  title: string;
  head: string;
  base: string;
  body: string;
}

export type GkEvent =
  | { kind: "session"; sessionId: string }
  | { kind: "phase"; phase: GkPhase }
  | { kind: "trace"; step: TraceRow }
  | { kind: "upgrades"; upgrades: Upgrade[]; summary: string }
  | { kind: "approval"; pr: PendingPr }
  | { kind: "pr"; url: string; number: number | null }
  | { kind: "note"; text: string }
  | { kind: "error"; message: string }
  | { kind: "end" };

/** Serialize one event as an SSE frame. */
export function sse(event: GkEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}
