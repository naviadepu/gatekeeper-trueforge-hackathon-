// Shared types and the fake agent output.
// When TrueForge is wired in, only this file's data needs to change — the
// components all read from these shapes.

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

export const REPO = "naviadepu/portfolio-navi-deploy";
export const BRANCH = "gatekeeper/audit-fixes";
export const PR_NUMBER = 12;

export const TRACE: TraceStep[] = [
  { id: "read", verb: "Read", label: "package.json", meta: "34 dependencies" },
  {
    id: "audit",
    verb: "Ran",
    label: "npm audit in sandbox",
    meta: "2 advisories · 1 high, 1 moderate",
  },
  {
    id: "build",
    verb: "Ran",
    label: "build check in sandbox",
    meta: "patched tree compiles",
  },
];

export const INITIAL_UPGRADES: Upgrade[] = [
  {
    id: "lodash",
    name: "lodash",
    from: "4.17.15",
    to: "4.17.21",
    risk: "patch",
    note: "fixes prototype-pollution advisory (GHSA-p6mc-m468-83gg)",
    selected: true,
  },
  {
    id: "postcss",
    name: "postcss",
    from: "8.4.14",
    to: "8.4.31",
    risk: "patch",
    note: "fixes line-return parsing advisory",
    selected: true,
  },
  {
    id: "tailwind",
    name: "tailwindcss",
    from: "3.3.0",
    to: "3.4.1",
    risk: "minor",
    note: "minor release, no breaking changes listed",
    selected: true,
  },
  {
    id: "next",
    name: "next",
    from: "13.2.4",
    to: "14.0.0",
    risk: "major",
    note: "major version — app-router changes may break the build",
    selected: false,
  },
];
