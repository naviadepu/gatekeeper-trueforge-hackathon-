"use client";

import { useCallback, useRef, useState } from "react";

import type { Upgrade } from "./data";
import type { GkEvent, GkPhase, PendingPr, TraceRow } from "@/lib/trueforge/protocol";

export interface AgentRunState {
  phase: "idle" | GkPhase | "error";
  trace: TraceRow[];
  upgrades: Upgrade[];
  summary: string;
  notes: string[];
  pendingPr: PendingPr | null;
  pr: { url: string; number: number | null } | null;
  error: string | null;
  /** True while an SSE stream is open (audit or open-PR turn running). */
  busy: boolean;
}

const INITIAL: AgentRunState = {
  phase: "idle",
  trace: [],
  upgrades: [],
  summary: "",
  notes: [],
  pendingPr: null,
  pr: null,
  error: null,
  busy: false,
};

/** Parse an SSE `Response` body and invoke `onEvent` per `data:` frame. */
async function readSse(res: Response, onEvent: (e: GkEvent) => void): Promise<void> {
  if (!res.body) throw new Error("No response stream.");
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let sep: number;
    while ((sep = buffer.indexOf("\n\n")) !== -1) {
      const frame = buffer.slice(0, sep);
      buffer = buffer.slice(sep + 2);
      const data = frame
        .split("\n")
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n");
      if (!data) continue;
      try {
        onEvent(JSON.parse(data) as GkEvent);
      } catch {
        /* ignore */
      }
    }
  }
}

export function useAgentRun() {
  const [state, setState] = useState<AgentRunState>(INITIAL);
  const sessionIds = useRef<string[]>([]);
  const pendingRef = useRef<PendingPr | null>(null);

  const apply = useCallback((e: GkEvent) => {
    switch (e.kind) {
      case "session":
        if (!sessionIds.current.includes(e.sessionId)) sessionIds.current.push(e.sessionId);
        break;
      case "phase":
        setState((s) => ({ ...s, phase: e.phase }));
        break;
      case "trace":
        setState((s) => {
          const i = s.trace.findIndex((t) => t.id === e.step.id);
          const trace = i === -1 ? [...s.trace, e.step] : s.trace.map((t, j) => (j === i ? e.step : t));
          return { ...s, trace };
        });
        break;
      case "upgrades":
        setState((s) => ({ ...s, upgrades: e.upgrades, summary: e.summary }));
        break;
      case "note":
        setState((s) => ({ ...s, notes: [...s.notes, e.text] }));
        break;
      case "approval":
        pendingRef.current = e.pr;
        setState((s) => ({ ...s, pendingPr: e.pr }));
        break;
      case "pr":
        setState((s) => ({ ...s, pr: { url: e.url, number: e.number } }));
        break;
      case "error":
        setState((s) => ({ ...s, phase: "error", error: e.message, busy: false }));
        break;
      case "end":
        setState((s) => ({ ...s, busy: false }));
        break;
    }
  }, []);

  const pump = useCallback(
    async (res: Response) => {
      if (!res.ok && res.headers.get("content-type")?.includes("application/json")) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setState((s) => ({ ...s, phase: "error", error: j?.error ?? `Request failed (${res.status})`, busy: false }));
        return;
      }
      try {
        await readSse(res, apply);
      } catch (err) {
        setState((s) => ({
          ...s,
          phase: "error",
          error: err instanceof Error ? err.message : "Lost the connection to the agent.",
          busy: false,
        }));
      }
    },
    [apply],
  );

  const start = useCallback(
    async (repo?: string) => {
      sessionIds.current = [];
      pendingRef.current = null;
      setState({ ...INITIAL, phase: "working", busy: true });
      const res = await fetch("/api/agent/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ repo }),
      });
      await pump(res);
    },
    [pump],
  );

  /** Ledger "Approve" and the final PR "Confirm" both land here. */
  const approve = useCallback(
    async (repo?: string) => {
      const pending = pendingRef.current;
      setState((s) => ({ ...s, busy: true, error: null }));

      if (pending) {
        const res = await fetch("/api/agent/approve", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({
            step: "confirm",
            sessionId: sessionIds.current[sessionIds.current.length - 1],
            threadId: pending.threadId,
            toolCallId: pending.toolCallId,
          }),
        });
        pendingRef.current = null;
        setState((s) => ({ ...s, pendingPr: null }));
        await pump(res);
        return;
      }

      const selected = state.upgrades
        .filter((u) => u.selected)
        .map((u) => ({ name: u.name, from: u.from, to: u.to }));
      const res = await fetch("/api/agent/approve", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ step: "start", repo, upgrades: selected }),
      });
      await pump(res);
    },
    [pump, state.upgrades],
  );

  const decline = useCallback(async () => {
    setState((s) => ({ ...s, phase: "declined", busy: false, pendingPr: null }));
    pendingRef.current = null;
    await fetch("/api/agent/decline", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ sessionIds: sessionIds.current }),
    }).catch(() => {});
  }, []);

  const toggle = useCallback((id: string) => {
    setState((s) => ({
      ...s,
      upgrades: s.upgrades.map((u) => (u.id === id ? { ...u, selected: !u.selected } : u)),
    }));
  }, []);

  const reset = useCallback(() => {
    sessionIds.current = [];
    pendingRef.current = null;
    setState(INITIAL);
  }, []);

  return { ...state, start, approve, decline, toggle, reset };
}
