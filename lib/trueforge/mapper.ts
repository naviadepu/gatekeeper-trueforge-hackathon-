/**
 * Translates a TrueForge turn's event stream into Gatekeeper's UI protocol
 * (`GkEvent`).
 *
 * Two things make this fiddly:
 *  - Tool calls stream in as `model.message.delta` fragments (name first, then
 *    argument chunks), so we assemble them per message.
 *  - With deferred MCP discovery the model calls a `call_tool` wrapper rather
 *    than the GitHub tool directly; we unwrap it. Discovery meta-tools
 *    (`list_tools`, `get_tool_info`) are hidden from the trace.
 */

import type { Upgrade } from "@/components/gatekeeper/data";
import type { GkEvent } from "./protocol";
import type {
  ModelMessageDeltaEvent,
  ModelMessageEvent,
  ToolApprovalRequiredEvent,
  ToolResponseEvent,
  TurnDoneEvent,
  TurnStreamEvent,
} from "./types";

type ToolArgs = Record<string, unknown>;

interface KnownCall {
  /** Effective tool name (unwrapped from `call_tool` when needed). */
  name: string;
  args: ToolArgs;
  hidden: boolean;
}

const HIDDEN_TOOLS = new Set(["list_tools", "get_tool_info", "list_mcp_servers"]);

const truncate = (s: string, n = 64) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);
const oneLine = (s: string) => s.replace(/\s+/g, " ").trim();

function parseJson(raw: string): ToolArgs {
  try {
    const v = JSON.parse(raw);
    return v && typeof v === "object" ? (v as ToolArgs) : {};
  } catch {
    return {};
  }
}

/** Unwrap `call_tool({ tool_name, input })` into the effective call. */
function effectiveCall(name: string, args: ToolArgs): { name: string; args: ToolArgs } {
  if (name === "call_tool") {
    const inner = typeof args.tool_name === "string" ? args.tool_name : "tool";
    const input = (args.input ?? args.arguments ?? {}) as ToolArgs;
    return { name: inner, args: typeof input === "object" ? input : {} };
  }
  return { name, args };
}

function describeCall(call: KnownCall): { verb: string; label: string; meta: string } {
  const { name, args } = call;
  const s = (k: string) => (typeof args[k] === "string" ? (args[k] as string) : undefined);

  switch (name) {
    case "get_file_contents":
      return { verb: "Read", label: s("path") ?? "file", meta: [s("owner"), s("repo")].filter(Boolean).join("/") };
    case "get_me":
      return { verb: "Checked", label: "GitHub identity", meta: "" };
    case "list_branches":
      return { verb: "Listed", label: "branches", meta: "" };
    case "list_commits":
    case "get_commit":
      return { verb: "Checked", label: "commit history", meta: "" };
    case "create_branch":
      return { verb: "Created", label: `branch ${s("branch") ?? ""}`.trim(), meta: "" };
    case "create_or_update_file":
      return { verb: "Committed", label: s("path") ?? "package.json", meta: "" };
    case "push_files": {
      const files = Array.isArray(args.files) ? args.files.length : undefined;
      return { verb: "Committed", label: files ? `${files} file${files === 1 ? "" : "s"}` : "changes", meta: "" };
    }
    case "create_pull_request":
      return { verb: "Opening", label: "pull request", meta: s("head") ? `${s("head")} → ${s("base") ?? "main"}` : "" };
    case "create_sub_agent":
      return { verb: "Delegated", label: truncate(s("name") ?? s("task") ?? "a subtask"), meta: "" };
    case "exec":
    case "bash":
    case "shell":
    case "sandbox_exec":
    case "python": {
      const intent = s("intent");
      const cmd = s("command") ?? s("cmd") ?? s("code") ?? s("script");
      return {
        verb: "Ran",
        label: truncate(oneLine(intent ?? cmd ?? name)),
        meta: cmd ? truncate(oneLine(cmd), 44) : "sandbox",
      };
    }
    default:
      return { verb: "Ran", label: name.replace(/_/g, " "), meta: "" };
  }
}

function summarizeResponse(content: string): string {
  const text = oneLine(content);
  if (/^Content too big/i.test(text)) return "large result — offloaded";
  try {
    const j = JSON.parse(content) as Record<string, unknown>;
    // sandbox exec: { success, response: { exitCode, result } }
    const resp = j.response as Record<string, unknown> | undefined;
    if (resp && ("exitCode" in resp || "result" in resp)) {
      const result = typeof resp.result === "string" ? oneLine(resp.result) : "";
      const code = typeof resp.exitCode === "number" ? resp.exitCode : 0;
      if (/command not found|Traceback|not recoverable|Cannot exec|\bError\b/i.test(result)) {
        return truncate(result, 60);
      }
      if (code !== 0) return `exit ${code}`;
      return result ? truncate(result, 60) : "ok";
    }
    if (typeof j.message === "string") return truncate(j.message, 72);
    if (typeof j.total_count === "number") return `${j.total_count} result${j.total_count === 1 ? "" : "s"}`;
    if (typeof j.html_url === "string") return "done";
    if (typeof j.sha === "string") return `sha ${(j.sha as string).slice(0, 7)}`;
  } catch {
    /* not JSON */
  }
  if (/successfully downloaded/i.test(text)) return "downloaded";
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

interface DeltaSlot {
  id: string;
  name: string;
  argsRaw: string;
}

export class RunMapper {
  private calls = new Map<string, KnownCall>();
  private deltaSlots = new Map<number, DeltaSlot>();
  private prEmitted = false;

  constructor(
    private mode: "audit" | "openpr",
    opts: { createPrCallId?: string } = {},
  ) {
    // On a confirm-step turn this mapper is fresh and never sees the
    // `model.message` that first requested the pull request, so seed it.
    if (opts.createPrCallId) {
      this.calls.set(opts.createPrCallId, { name: "create_pull_request", args: {}, hidden: false });
    }
  }

  handle(event: TurnStreamEvent): GkEvent[] {
    switch (event.type) {
      case "sandbox.created":
        return [{ kind: "trace", step: { id: "sandbox", verb: "Started", label: "sandbox", meta: "", status: "done" } }];

      case "thread.created": {
        const e = event as { thread_id: string; title?: string };
        return [
          {
            kind: "trace",
            step: {
              id: `thread-${e.thread_id}`,
              verb: "Delegated",
              label: truncate(e.title ?? "a subtask"),
              meta: "subagent",
              status: "running",
            },
          },
        ];
      }

      case "model.message.delta":
        return this.onDelta(event as ModelMessageDeltaEvent);

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

  /** Assemble streamed tool calls; flush them when the message finishes. */
  private onDelta(e: ModelMessageDeltaEvent): GkEvent[] {
    for (const tc of e.tool_calls ?? []) {
      const slot = this.deltaSlots.get(tc.index) ?? { id: "", name: "", argsRaw: "" };
      if (tc.id) slot.id = tc.id;
      if (tc.function?.name) slot.name = tc.function.name;
      if (tc.function?.arguments) slot.argsRaw += tc.function.arguments;
      this.deltaSlots.set(tc.index, slot);
    }
    if (e.finish_reason === "tool_calls") return this.flushDeltas();
    return [];
  }

  private flushDeltas(): GkEvent[] {
    const out: GkEvent[] = [];
    for (const slot of this.deltaSlots.values()) {
      if (!slot.id || !slot.name) continue;
      const eff = effectiveCall(slot.name, parseJson(slot.argsRaw));
      const hidden = HIDDEN_TOOLS.has(eff.name);
      this.calls.set(slot.id, { ...eff, hidden });
      if (hidden) continue;
      out.push({ kind: "trace", step: { id: slot.id, ...describeCall({ ...eff, hidden }), status: "running" } });
    }
    this.deltaSlots.clear();
    return out;
  }

  private onModelMessage(e: ModelMessageEvent): GkEvent[] {
    const out: GkEvent[] = [];
    // Some providers deliver assembled tool calls here instead of via deltas.
    for (const tc of e.tool_calls ?? []) {
      if (!tc.id || !tc.function?.name) continue;
      const eff = effectiveCall(tc.function.name, parseJson(tc.function.arguments));
      const hidden = HIDDEN_TOOLS.has(eff.name);
      this.calls.set(tc.id, { ...eff, hidden });
      if (!hidden) out.push({ kind: "trace", step: { id: tc.id, ...describeCall({ ...eff, hidden }), status: "running" } });
    }
    const note = oneLine(textOf(e.content));
    if (note.length > 8 && (!e.tool_calls || e.tool_calls.length === 0)) {
      out.push({ kind: "note", text: truncate(note, 180) });
    }
    return out;
  }

  private onToolResponse(e: ToolResponseEvent): GkEvent[] {
    const call = this.calls.get(e.tool_call_id);
    const out: GkEvent[] = [];

    if (call && !call.hidden) {
      out.push({
        kind: "trace",
        step: { id: e.tool_call_id, ...describeCall(call), meta: summarizeResponse(e.content), status: "done" },
      });
    }
    if (call?.name === "create_pull_request") {
      const pr = parsePr(e.content);
      if (pr) {
        this.prEmitted = true;
        out.push({ kind: "pr", ...pr }, { kind: "phase", phase: "done" });
      }
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

    const paused = st.required_actions?.some((a) => a.type === "tool.approval_required");
    if (paused) return [];

    if (this.mode === "audit") {
      const raw = st.output ? textOf(st.output.content) : "";
      let parsed: unknown;
      try {
        parsed = JSON.parse(raw);
      } catch {
        const m = raw.match(/\{[\s\S]*\}/);
        try {
          parsed = m ? JSON.parse(m[0]) : null;
        } catch {
          parsed = null;
        }
      }
      if (!parsed) return [{ kind: "error", message: "The audit finished but returned no readable result." }];
      const { upgrades, summary } = coerceUpgrades(parsed);
      if (upgrades.length === 0) {
        return [{ kind: "note", text: summary || "No upgrades proposed." }, { kind: "phase", phase: "waiting" }];
      }
      return [
        { kind: "upgrades", upgrades, summary },
        { kind: "phase", phase: "waiting" },
      ];
    }

    // openpr: make sure the PR link gets through even if the tool.response
    // parse missed it (e.g. the model only echoed the URL in its final text).
    const out: GkEvent[] = [];
    if (!this.prEmitted && st.output) {
      const pr = parsePr(textOf(st.output.content));
      if (pr) {
        this.prEmitted = true;
        out.push({ kind: "pr", ...pr });
      }
    }
    out.push({ kind: "phase", phase: "done" });
    return out;
  }
}
