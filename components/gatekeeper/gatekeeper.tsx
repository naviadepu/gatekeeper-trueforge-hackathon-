"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import "./gatekeeper.css";
import { REPO } from "./data";
import { Atmosphere, type Pulse } from "./atmosphere";
import { InstrumentFrame } from "./frame";
import { useAgentRun } from "./use-agent-run";
import { BootGate } from "./boot-gate";
import {
  ConfirmScreen,
  DeclinedScreen,
  DoneScreen,
  ErrorScreen,
  StartScreen,
  WaitingScreen,
  WorkingScreen,
} from "./screens";

const STATE_CODE: Record<string, string> = {
  idle: "standing by",
  working: "auditing · sandbox",
  waiting: "awaiting human",
  confirming: "paused · create_pull_request",
  opening: "opening pull request",
  done: "pr open",
  declined: "run closed",
  error: "run halted",
};

/**
 * Top-level container. All agent state lives in `useAgentRun` (which drives it
 * from TrueForge's SSE stream); this component only owns two bits of transient
 * UI feedback — `tense` (Approve is hovered) and `pulse` (atmosphere flash).
 */
export function Gatekeeper() {
  const run = useAgentRun();
  const [tense, setTense] = useState(false);
  const [pulse, setPulse] = useState<Pulse>({ key: 0, kind: null });
  // Bump-counter for the "curtain" that parts when you commit mid-flow
  // (approve the set, confirm the PR). Keyed so each click remounts and
  // replays it; cleared on animationend, with a timeout fallback.
  const [curtain, setCurtain] = useState(0);
  // The very first click swings the on-screen gate open before the run starts.
  const [gateOpening, setGateOpening] = useState(false);
  // The intro: a diamond splits open onto the app, once, on load.
  const [booting, setBooting] = useState(true);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(() => setBooting(false), reduced ? 0 : 1500);
    return () => window.clearTimeout(t);
  }, []);

  /** Run `act` and part the curtain over the transition it triggers. */
  const withCurtain = useCallback((act: () => void) => {
    setCurtain((n) => n + 1);
    act();
  }, []);

  useEffect(() => {
    if (!curtain) return;
    const t = setTimeout(() => setCurtain(0), 750);
    return () => clearTimeout(t);
  }, [curtain]);

  /** The first click: the gate on screen swings open, then the run begins. */
  const openGate = useCallback(() => {
    setGateOpening(true);
    setPulse((p) => ({ key: p.key + 1, kind: "flash" }));
  }, []);

  // Kick off the run once the gate has had time to open. Keyed on the flag so
  // the timer is cleared if the component unmounts (or resets) mid-animation.
  const start = run.start;
  useEffect(() => {
    if (!gateOpening) return;
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const t = window.setTimeout(start, reduced ? 0 : 420);
    return () => window.clearTimeout(t);
  }, [gateOpening, start]);

  const resetRun = useCallback(() => {
    setGateOpening(false);
    run.reset();
  }, [run]);

  const selectedCount = run.upgrades.filter((u) => u.selected).length;
  const approved = useMemo(() => run.upgrades.filter((u) => u.selected), [run.upgrades]);
  const skipped = useMemo(() => run.upgrades.filter((u) => !u.selected), [run.upgrades]);

  // Flash the atmosphere on each toggle / when the gate opens.
  const prevPhase = useRef(run.phase);
  useEffect(() => {
    if (run.phase !== prevPhase.current && run.phase === "done") {
      setPulse((p) => ({ key: p.key + 1, kind: "flash" }));
    }
    prevPhase.current = run.phase;
  }, [run.phase]);

  const toggle = (id: string) => {
    run.toggle(id);
    setPulse((p) => ({ key: p.key + 1, kind: "tick" }));
  };

  return (
    <main className="gk">
      <Atmosphere pulse={pulse} />
      <InstrumentFrame stateCode={STATE_CODE[run.phase] ?? run.phase} />

      <div className={`gk-wrap gk-wrap--${run.phase}`}>
        {run.phase === "idle" && (
          <StartScreen repo={REPO} opening={gateOpening} onStart={openGate} />
        )}

        {run.phase === "working" && <WorkingScreen rows={run.trace} notes={run.notes} />}

        {run.phase === "opening" && (
          <WorkingScreen rows={run.trace} notes={run.notes} opening />
        )}

        {run.phase === "waiting" && (
          <WaitingScreen
            upgrades={run.upgrades}
            summary={run.summary}
            selectedCount={selectedCount}
            rows={run.trace}
            tense={tense}
            busy={run.busy}
            onToggle={toggle}
            onTenseChange={setTense}
            onApprove={() => {
              setTense(false);
              withCurtain(() => run.approve());
            }}
            onDecline={() => {
              setTense(false);
              run.decline();
            }}
          />
        )}

        {run.phase === "confirming" && run.pendingPr && (
          <ConfirmScreen
            pr={run.pendingPr}
            rows={run.trace}
            notes={run.notes}
            busy={run.busy}
            onConfirm={() => withCurtain(() => run.approve())}
            onDecline={() => run.decline()}
          />
        )}

        {run.phase === "done" && (
          <DoneScreen
            approved={approved}
            skipped={skipped}
            pr={run.pr}
            rows={run.trace}
            onReset={resetRun}
          />
        )}

        {run.phase === "declined" && <DeclinedScreen rows={run.trace} onReset={resetRun} />}

        {run.phase === "error" && (
          <ErrorScreen message={run.error ?? "Something went wrong."} onReset={resetRun} />
        )}
      </div>

      {curtain > 0 && (
        <div key={curtain} className="gk-curtain" aria-hidden onAnimationEnd={() => setCurtain(0)}>
          <span />
          <span />
        </div>
      )}

      {booting && <BootGate />}
    </main>
  );
}
