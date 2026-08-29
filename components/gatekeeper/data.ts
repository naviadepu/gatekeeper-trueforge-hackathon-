// Shared types + display defaults for the Gatekeeper UI.
//
// The agent's output is no longer hardcoded here — it streams from TrueForge
// via `use-agent-run.ts` (see `lib/trueforge/`). What stays is the type
// vocabulary the components render against, plus a couple of display fallbacks.

export type Phase = "working" | "waiting" | "done" | "declined";

export type Risk = "patch" | "minor" | "major";

export type Upgrade = {
  id: string;
  name: string;
  from: string;
  to: string;
  risk: Risk;
  note: string;
  /** Whether the human has this upgrade checked for the PR. */
  selected: boolean;
};

/** One line in the trace ledger — what the agent has done / is doing. */
export type TraceStep = {
  id: string;
  /** Bold verb + rest of the sentence, e.g. "Ran" + "npm audit in sandbox". */
  verb: string;
  label: string;
  /** Right-aligned detail. */
  meta: string;
};

/** Default target repo — mirrors GATEKEEPER_TARGET_REPO in .env. Task 3 makes this an input. */
export const REPO = "naviadepu/portfolio-navi-deploy";

/** Branch the open-PR agent works on. Kept in sync with `AUDIT_BRANCH` in lib/trueforge/agent-spec.ts. */
export const BRANCH = "gatekeeper/audit-fixes";
