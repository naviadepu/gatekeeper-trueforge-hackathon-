"use client";

import { useCallback, useMemo, useState } from "react";

import "./gatekeeper.css";
import { INITIAL_UPGRADES, type Phase } from "./data";
import { Atmosphere, type Pulse } from "./atmosphere";
import { InstrumentFrame } from "./frame";
import { DeclinedScreen, DoneScreen, WaitingScreen, WorkingScreen } from "./screens";

const STATE_CODE: Record<Phase, string> = {
  working: "working",
  waiting: "awaiting human",
  done: "pr open · 12",
  declined: "run closed",
};

/**
 * Top-level state container. Holds the phase, the upgrade selections, and two
 * bits of transient feedback state (`tense` = Approve is hovered, `pulse` =
 * one-shot atmosphere flash). Everything visual lives in the screen components.
 */
export function Gatekeeper() {
  const [phase, setPhase] = useState<Phase>("working");
  const [upgrades, setUpgrades] = useState(INITIAL_UPGRADES);
  const [tense, setTense] = useState(false);
  const [pulse, setPulse] = useState<Pulse>({ key: 0, kind: null });

  const selectedCount = upgrades.filter((u) => u.selected).length;

  const toggle = useCallback((id: string) => {
    setUpgrades((prev) =>
      prev.map((u) => (u.id === id ? { ...u, selected: !u.selected } : u)),
    );
    setPulse((p) => ({ key: p.key + 1, kind: "tick" }));
  }, []);

  const approve = useCallback(() => {
    setPulse((p) => ({ key: p.key + 1, kind: "flash" }));
    setTense(false);
    setPhase("done");
  }, []);

  const decline = useCallback(() => {
    setTense(false);
    setPhase("declined");
  }, []);

  const reset = useCallback(() => setPhase("waiting"), []);

  const approved = useMemo(() => upgrades.filter((u) => u.selected), [upgrades]);
  const skipped = useMemo(() => upgrades.filter((u) => !u.selected), [upgrades]);

  return (
    <main className="gk">
      <Atmosphere pulse={pulse} />
      <InstrumentFrame stateCode={STATE_CODE[phase]} />

      <div className="gk-wrap">
        {phase === "working" && <WorkingScreen onComplete={reset} />}
        {phase === "waiting" && (
          <WaitingScreen
            upgrades={upgrades}
            selectedCount={selectedCount}
            tense={tense}
            onToggle={toggle}
            onTenseChange={setTense}
            onApprove={approve}
            onDecline={decline}
          />
        )}
        {phase === "done" && (
          <DoneScreen approved={approved} skipped={skipped} onReset={reset} />
        )}
        {phase === "declined" && <DeclinedScreen onReset={reset} />}
      </div>

      <PhaseSwitcher phase={phase} onSelect={setPhase} />
    </main>
  );
}

/** Dev-only: jump between phases without waiting for the flow. */
function PhaseSwitcher({
  phase,
  onSelect,
}: {
  phase: Phase;
  onSelect: (p: Phase) => void;
}) {
  const phases: Phase[] = ["working", "waiting", "done", "declined"];
  return (
    <div className="gk-dev">
      <span className="gk-dev__tag">dev</span>
      {phases.map((p) => (
        <button
          key={p}
          type="button"
          className={p === phase ? "gk-dev__btn gk-dev__btn--on" : "gk-dev__btn"}
          onClick={() => onSelect(p)}
        >
          {p}
        </button>
      ))}
    </div>
  );
}
