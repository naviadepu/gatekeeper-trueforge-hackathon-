/**
 * Translates a TrueForge turn's event stream into Gatekeeper's UI protocol
 * (`GkEvent`). Stateful: `tool.approval_required` and `tool.response` only carry
 * a tool-call id, so we remember the tool calls seen on `model.message` events.
 */

import type { Upgrade } from "@/components/gatekeeper/data";
import type { GkEvent } from "./protocol";
import type {
  ModelMessageEvent,
  RawToolCall,
  ToolApprovalRequiredEvent,
  ToolResponseEvent,
  TurnDoneEvent,
  TurnStreamEvent,
} from "./types";

type ToolArgs = Record<string, unknown>;

interface KnownCall {
  name: string;
  args: ToolArgs;
  isMcp: boolean;
}

const truncate = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function parseArgs(raw: string): ToolArgs {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as ToolArgs) : {};
  } catch {
    return {};
  }
}

/** A trace row `{ verb, label, meta }` for a tool call. */
function describeCall(call: KnownCall): { verb: string; label: string; meta: string } {
  const { name, args } = call;
  const s = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : undefined);

  switch (name) {
    case "get_file_contents":
      return { verb: "Read", label: s("path") ?? "file", meta: [s("owner"), s("repo")].filter(Boolean).join("/") };
    case "list_branches":
      return { verb: "Checked", label: "branches", meta: "" };
    case "list_commits":
    case "get_commit":
      return { verb: "Checked", label: "commit history", meta: "" };
    case "create_branch":
      return { verb: "Created", label: `branch ${s("branch") ?? ""}`.trim(), meta: "" };
    case "create_or_update_file":
      return { verb: "Committed", label: s("path") ?? "file", meta: "" };
    case "push_files": {
      const files = Array.isArray(args.files) ? args.files.length : undefined;
      return { verb: "Committed", label: files ? `${files} file${files === 1 ? "" : "s"}` : "changes", meta: "" };
    }
    case "create_pull_request":
      return { verb: "Opening", label: "pull request", meta: s("head") ? `${s("head")} → ${s("base") ?? "main"}` : "" };
    case "bash":
    case "shell":
    case "sandbox_exec":
    case "python": {
      const cmd = s("command") ?? s("cmd") ?? s("code") ?? s("script");
      return { verb: "Ran", label: cmd ? truncate(oneLine(cmd)) : name, meta: "sandbox" };
    }
    default:
      return { verb: call.isMcp ? "Called" : "Ran", label: name.replace(/_/g, " "), meta: "" };
  }
}

function summarizeResponse(content: string): string {
  const text = oneLine(content);
  try {
    const j = JSON.parse(content) as Record<string, unknown>;
    if (typeof j.message === "string") return truncate(j.message, 72);
    const meta = j.metadata as Record<string, unknown> | undefined;
    if (meta && typeof meta.vulnerabilities === "object") return "audit complete";
    if (typeof j.total_count === "number") return `${j.total_count} result${j.total_count === 1 ? "" : "s"}`;
    if (typeof j.html_url === "string") return "done";
  } catch {
    /* not JSON */
  }
  return truncate(text, 72);
}

function parsePr(content: string): { url: string; number: number | null } | null {
  try {
    const j = JSON.parse(content) as Record<string, unknown>;
    const url = (j.html_url ?? j.url ?? (j.pull_request as Record<string, unknown>)?.html_url) as string | undefined;
    if (url && url.includes("/pull/")) {
      const num = typeof j.number === "number" ? j.number : Number(url.split("/pull/")[1]) || null;
      return { url, number: num };
    }
  } catch {
    /* ignore */
  }
  const m = content.match(/https?:\/\/github\.com\/[^\s"']+\/pull\/(\d+)/);
  return m ? { url: m[0], number: Number(m[1]) } : null;
}

function coerceUpgrades(raw: unknown): { upgrades: Upgrade[]; summary: string } {
  const obj = (raw ?? {}) as Record<string, unknown>;
  const list = Array.isArray(obj.upgrades) ? obj.upgrades : [];
  const upgrades: Upgrade[] = list.map((u, i) => {
    const r = (u ?? {}) as Record<string, unknown>;
    const risk = r.risk === "minor" || r.risk === "major" ? r.risk : "patch";
    return {
      id: typeof r.name === "string" ? r.name : `pkg-${i}`,
      name: typeof r.name === "string" ? r.name : `package ${i + 1}`,
      from: typeof r.from === "string" ? r.from : "?",
      to: typeof r.to === "string" ? r.to : "?",
      risk,
      note: typeof r.note === "string" ? r.note : "",
      selected: r.recommended !== false && risk !== "major",
    };
  });
  return { upgrades, summary: typeof obj.audit_summary === "string" ? obj.audit_summary : "" };
}

function textOf(content: ModelMessageEvent["content"]): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) return content.map((p) => p.text ?? "").join("");
  return "";
}

export class RunMapper {
  private calls = new Map<string, KnownCall>();

  constructor(private mode: "audit" | "openpr") {}

  handle(event: TurnStreamEvent): GkEvent[] {
    switch (event.type) {
      case "sandbox.created":
        return [{ kind: "trace", step: { id: "sandbox", verb: "Started", label: "sandbox", meta: "", status: "done" } }];

      case "model.message":
        return this.onModelMessage(event as ModelMessageEvent);

      case "tool.response":
        return this.onToolResponse(event as ToolResponseEvent);

      case "tool.approval_required":
        return this.onApprovalRequired(event as ToolApprovalRequiredEvent);

      case "turn.done":
        return this.onTurnDone(event as TurnDoneEvent);

      default:
        return [];
    }
  }

  private register(tc: RawToolCall): KnownCall {
    const call: KnownCall = {
      name: tc.function.name,
      args: parseArgs(tc.function.arguments),
      isMcp: tc.tool_info?.type === "mcp",
    };
    this.calls.set(tc.id, call);
    return call;
  }

  private onModelMessage(e: ModelMessageEvent): GkEvent[] {
    const out: GkEvent[] = [];
    const note = oneLine(textOf(e.content));
    if (note.length > 8 && (!e.tool_calls || e.tool_calls.length === 0)) {
      out.push({ kind: "note", text: truncate(note, 160) });
    }
    for (const tc of e.tool_calls ?? []) {
      const call = this.register(tc);
      const d = describeCall(call);
      out.push({ kind: "trace", step: { id: tc.id, ...d, status: "running" } });
    }
    return out;
  }

  private onToolResponse(e: ToolResponseEvent): GkEvent[] {
    const call = this.calls.get(e.tool_call_id);
    const d = call ? describeCall(call) : { verb: "Ran", label: "step", meta: "" };
    const out: GkEvent[] = [
      { kind: "trace", step: { id: e.tool_call_id, ...d, meta: summarizeResponse(e.content), status: "done" } },
    ];
    if (call?.name === "create_pull_request") {
      const pr = parsePr(e.content);
      if (pr) out.push({ kind: "pr", ...pr }, { kind: "phase", phase: "done" });
    }
    return out;
  }

  private onApprovalRequired(e: ToolApprovalRequiredEvent): GkEvent[] {
    for (const ref of e.tool_calls) {
      const call = this.calls.get(ref.id);
      if (call?.name !== "create_pull_request") continue;
      const a = call.args;
      const str = (k: string, d = "") => (typeof a[k] === "string" ? (a[k] as string) : d);
      return [
        { kind: "phase", phase: "confirming" },
        {
          kind: "approval",
          pr: {
            threadId: e.thread_id,
            toolCallId: ref.id,
            title: str("title", "Gatekeeper: apply approved dependency upgrades"),
            head: str("head"),
            base: str("base", "main"),
            body: str("body"),
          },
        },
      ];
    }
    return [];
  }

  private onTurnDone(e: TurnDoneEvent): GkEvent[] {
    const st = e.state;
    if (st.status === "error") return [{ kind: "error", message: st.message || "The agent run failed." }];
    if (st.status === "cancelled") return [{ kind: "phase", phase: "declined" }];

    // status === "done"
    const paused = st.required_actions?.some((a) => a.type === "tool.approval_required");
    if (paused) return []; // approval already surfaced; wait for the human

    if (this.mode === "audit") {
      const raw = st.output ? textOf(st.output.content) : "";
      let parsed: unknown = {};
      try {
        parsed = JSON.parse(raw);
      } catch {
        return [{ kind: "error", message: "The audit finished but returned no readable result." }];
      }
      const { upgrades, summary } = coerceUpgrades(parsed);
      if (upgrades.length === 0) {
        return [{ kind: "note", text: summary || "No upgrades proposed." }, { kind: "phase", phase: "waiting" }];
      }
      return [
        { kind: "upgrades", upgrades, summary },
        { kind: "phase", phase: "waiting" },
      ];
    }

    // openpr turn finished without a create_pull_request response we could parse
    return [{ kind: "phase", phase: "done" }];
  }
}
