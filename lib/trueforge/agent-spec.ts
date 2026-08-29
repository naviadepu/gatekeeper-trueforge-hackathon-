/**
 * The two agent turns Gatekeeper runs, as inline TrueForge AgentSpecs.
 *
 *   1. AUDIT  — read the repo, run the audit + build check in a sandbox,
 *               return proposed upgrades as JSON. Read-only.
 *   2. OPEN PR — apply the human-selected upgrades on a branch, then open a
 *               pull request. Everything auto-runs except `create_pull_request`,
 *               which pauses for human approval — the one outward-facing,
 *               can't-take-it-back step.
 *
 * Both keep the tool surface tight and `preload` on, so a fast model calls the
 * GitHub tools directly instead of thrashing through deferred discovery.
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
            description: "True to pre-select this upgrade (patch/minor security fixes). False for risky majors.",
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
    model: { name: TRUEFORGE_MODEL },
    instructions: [
      "You are Gatekeeper, a dependency-upgrade auditor.",
      "Work quickly and stay on task: read one file, run the audit in the sandbox, report.",
      "Never call GitHub write tools. Do not browse commit history or search code.",
    ].join(" "),
    mcp_servers: [
      {
        name: "github",
        enable_tools: ["get_file_contents"],
        require_approval_for_tools: ["@write", "@destructive"],
        preload: true,
      },
    ],
    response_format: {
      type: "json_schema",
      json_schema: {
        name: "gatekeeper_audit",
        schema: UPGRADE_SCHEMA as unknown as Record<string, unknown>,
        strict: true,
      },
    },
    config: { sandbox: { enabled: true }, dynamic_sub_agents: { enabled: false }, iteration_limit: 40 },
  };
}

export function auditPrompt(repo: string): string {
  return [
    `Audit the dependencies of the GitHub repo \`${repo}\`. Be efficient — aim for under 15 steps.`,
    "",
    "Sandbox notes: it is a minimal image with NO node, npm, or xz. Install Node once by",
    "downloading the linux-x64 **.tar.gz** (gzip, not .tar.xz) from nodejs.org and adding its",
    "`bin` to PATH. Do not fight with `apt` or `.xz` archives.",
    "",
    "1. `get_file_contents` for `package.json` on the default branch (read it once).",
    "2. In a sandbox scratch dir, write that exact package.json, then run:",
    "     npm install --package-lock-only --silent && npm audit --json",
    "   Parse the advisories.",
    "3. For each advisory, decide the fix:",
    "   - If the vulnerable package is listed directly in `dependencies` OR `devDependencies`,",
    "     propose bumping it there to the smallest version that clears the advisory. Risk =",
    "     semver jump from the current spec (patch / minor / major). `recommended: true` for",
    "     patch and minor, `false` for major.",
    "   - If it is only a transitive dependency, propose an `overrides` entry pinning it to a",
    "     fixed version (name it `overrides/<pkg>`, risk `patch`, `recommended: true`).",
    "4. If you also see a safe direct patch/minor bump that removes an advisory, include it.",
    "",
    "At least one upgrade MUST be `recommended: true` if any advisory is fixable.",
    "Return only the required JSON. Do not create branches, commits, or pull requests.",
  ].join("\n");
}

export function openPrSpec(): AgentSpec {
  return {
    model: { name: TRUEFORGE_MODEL, params: { temperature: 0, parallel_tool_calls: false } },
    instructions: [
      "You are Gatekeeper executing an approved change. Do EXACTLY the three numbered steps in",
      "the user message, one tool call each, in order. The new file content is given to you",
      "verbatim — commit it byte-for-byte, do not regenerate or reformat it. Do not read other",
      "files or explore the repo. After the pull-request call, you are finished.",
    ].join(" "),
    mcp_servers: [
      {
        name: "github",
        enable_tools: ["create_branch", "create_or_update_file", "create_pull_request"],
        // The gate: pause only on the outward-facing, can't-take-it-back step.
        require_approval_for_tools: ["create_pull_request"],
        preload: true,
      },
    ],
    // No sandbox — the audit turn already ran the checks in one. This turn is
    // three GitHub API calls, which keeps it fast and predictable.
    config: { sandbox: { enabled: false }, dynamic_sub_agents: { enabled: false }, iteration_limit: 15 },
  };
}

export function openPrPrompt(
  repo: string,
  upgrades: Array<{ name: string; from: string; to: string }>,
  patchedPackageJson: string,
  baseSha: string,
): string {
  const [owner, name] = repo.split("/");
  const list = upgrades.map((u) => `- \`${u.name}\`: \`${u.from}\` → \`${u.to}\``).join("\n");
  const pkgs = upgrades.map((u) => (u.name.includes("/") ? u.name.split("/").pop() : u.name)).join(", ");
  return [
    `Repo: ${owner}/${name}. Apply an approved dependency upgrade. Exactly three tool calls, in order:`,
    "",
    `1. \`create_branch\` — owner \`${owner}\`, repo \`${name}\`, branch \`${AUDIT_BRANCH}\` from the`,
    "   default branch. If it errors because the branch already exists, continue anyway.",
    `2. \`create_or_update_file\` — owner \`${owner}\`, repo \`${name}\`, path \`package.json\`,`,
    `   branch \`${AUDIT_BRANCH}\`, sha \`${baseSha}\`, commit message "Gatekeeper: bump ${pkgs}",`,
    "   and `content` set to EXACTLY this (copy verbatim, do not change a single character):",
    "",
    "```json",
    patchedPackageJson.replace(/\n$/, ""),
    "```",
    "",
    `3. \`create_pull_request\` — owner \`${owner}\`, repo \`${name}\`, head \`${AUDIT_BRANCH}\`,`,
    "   base the default branch. Title:",
    `   "Gatekeeper: apply ${upgrades.length} approved dependency upgrade${upgrades.length === 1 ? "" : "s"}".`,
    "   Body (markdown):",
    "",
    list,
    "",
    "   plus one line: the sandbox audit already ran; a second human review and CI are still",
    "   required before merge.",
    "",
    "Step 3 will pause for my confirmation — that is expected. Stop there; do nothing else.",
  ].join("\n");
}
