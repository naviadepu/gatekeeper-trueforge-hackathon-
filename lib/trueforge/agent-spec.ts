/**
 * The two agent turns Gatekeeper runs, as inline TrueForge AgentSpecs.
 *
 *   1. AUDIT  — read the repo, run the audit + build check in a sandbox,
 *               return proposed upgrades as JSON. Read-only.
 *   2. OPEN PR — apply the human-selected upgrades on a branch, then open a
 *               pull request. Everything auto-runs except `create_pull_request`,
 *               which pauses for human approval — the one outward-facing,
 *               can't-take-it-back step.
 */

import type { AgentSpec } from "./types";
import { TRUEFORGE_MODEL } from "./client";

export const AUDIT_BRANCH = "gatekeeper/audit-fixes";

/** Shape the model must return from the audit turn. Mirrors the `Upgrade` UI type. */
export const UPGRADE_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    audit_summary: {
      type: "string",
      description: "One sentence: how many advisories, and their severities.",
    },
    upgrades: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          name: { type: "string", description: "Package name." },
          from: { type: "string", description: "Current version in package.json." },
          to: { type: "string", description: "Proposed version." },
          risk: { type: "string", enum: ["patch", "minor", "major"] },
          note: { type: "string", description: "Short reason — advisory id or why it matters." },
          recommended: {
            type: "boolean",
            description: "True to pre-select this upgrade for the PR (patch/minor security fixes). False for risky majors.",
          },
        },
        required: ["name", "from", "to", "risk", "note", "recommended"],
      },
    },
  },
  required: ["audit_summary", "upgrades"],
} as const;

export function auditSpec(): AgentSpec {
  return {
    model: { name: TRUEFORGE_MODEL, params: { reasoning_effort: "medium" } },
    instructions: [
      "You are Gatekeeper, a dependency-upgrade auditor.",
      "You work in a sandbox and through the GitHub connector. You never write to GitHub in this step.",
      "Be precise and conservative: only propose upgrades you can justify from the audit or the changelog.",
    ].join(" "),
    mcp_servers: [
      {
        name: "github",
        enable_tools: ["@read-only"],
        require_approval_for_tools: ["@write", "@destructive"],
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: { name: "gatekeeper_audit", schema: UPGRADE_SCHEMA as unknown as Record<string, unknown>, strict: true },
    },
    config: { sandbox: { enabled: true }, iteration_limit: 60 },
  };
}

export function auditPrompt(repo: string): string {
  return [
    `Audit the dependencies of the GitHub repo \`${repo}\`.`,
    "",
    "Steps:",
    `1. Read \`package.json\` from \`${repo}\` (default branch) via the GitHub connector.`,
    "2. In your sandbox, write that package.json into a scratch directory, run",
    "   `npm install --package-lock-only` then `npm audit --json`, and read the advisories.",
    "3. For the vulnerable packages, determine the smallest fixed version. Add well-justified",
    "   minor bumps if they clear an advisory. Flag major-version jumps as risky.",
    "4. Sanity-check that the patched set is internally consistent.",
    "",
    "Return the proposed upgrades in the required JSON format. Do not create branches, commits, or PRs.",
  ].join("\n");
}

export function openPrSpec(): AgentSpec {
  return {
    model: { name: TRUEFORGE_MODEL, params: { reasoning_effort: "medium" } },
    instructions: [
      "You are Gatekeeper. The human has reviewed the audit and approved a specific set of upgrades.",
      "Apply exactly those upgrades — no more, no less — on a dedicated branch, then open one pull request.",
      "Creating the pull request needs human approval; everything before it does not.",
    ].join(" "),
    mcp_servers: [
      {
        name: "github",
        enable_tools: [
          "get_file_contents",
          "get_me",
          "list_branches",
          "list_commits",
          "get_commit",
          "create_branch",
          "create_or_update_file",
          "push_files",
          "create_pull_request",
        ],
        // The gate: pause only on the step that reaches outside the sandbox.
        require_approval_for_tools: ["create_pull_request"],
      },
    ],
    config: { sandbox: { enabled: true }, iteration_limit: 60 },
  };
}

export function openPrPrompt(repo: string, upgrades: Array<{ name: string; from: string; to: string }>): string {
  const list = upgrades.map((u) => `- ${u.name}: ${u.from} -> ${u.to}`).join("\n");
  return [
    `Open a pull request on \`${repo}\` that applies exactly these dependency upgrades:`,
    "",
    list,
    "",
    "Steps:",
    `1. Create branch \`${AUDIT_BRANCH}\` from the default branch (skip if it already exists).`,
    "2. Update `package.json` on that branch so each listed package sits at its target version.",
    "   Change nothing else.",
    "3. In the sandbox, install the updated tree and run the project's build (or `npm run build`)",
    "   to confirm it still compiles. If it fails, stop and report why — do not open the PR.",
    `4. Open a pull request from \`${AUDIT_BRANCH}\` into the default branch. Title:`,
    `   "Gatekeeper: apply ${upgrades.length} approved dependency upgrade${upgrades.length === 1 ? "" : "s"}".`,
    "   Body: list the upgrades, the audit advisories they close, and note that a second human",
    "   review is still required before merge.",
    "",
    "When you call the tool to create the pull request it will pause for my approval.",
  ].join("\n");
}
