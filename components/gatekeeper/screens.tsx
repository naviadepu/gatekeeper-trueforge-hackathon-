"use client";

import { useEffect, useRef, useState } from "react";

import { BRANCH, PR_NUMBER, REPO, TRACE, type Upgrade } from "./data";
import { Gate } from "./gate";
import { CheckIcon, LockIcon, WarningIcon } from "./icons";
import { Trace } from "./trace";
import { UpgradeLedger } from "./upgrade-ledger";
import { ApproveBar } from "./approve-bar";

/* ---------------------------------------------------------------- shared bits */

function KRow({ status, live = false }: { status: string; live?: boolean }) {
  return (
    <div className="gk-krow">
      {live && <span className="gk-krow__dot" />}
      <span>Gatekeeper</span>
      <span>
        Run <em>001</em>
      </span>
      <span>{status}</span>
    </div>
  );
}

function Seg({ right }: { right: string }) {
  return (
    <div className="gk-seg">
      <span className="gk-seg__k">Trace</span>
      <span className="gk-seg__rule" />
      <span className="gk-seg__k">{right}</span>
    </div>
  );
}

/* ------------------------------------------------------------- working screen */

/**
 * The agent at work. Reveals the trace one row at a time, runs the build-check
 * meter to 100%, then — after a beat — calls `onComplete` to present the gate.
 */
export function WorkingScreen({ onComplete }: { onComplete: () => void }) {
  const [shown, setShown] = useState(0);
  const [progress, setProgress] = useState(0);
  const done = progress >= 100;
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const timers = [
      setTimeout(() => setShown(1), 350),
      setTimeout(() => setShown(2), 1250),
      setTimeout(() => setShown(3), 2200),
      setTimeout(() => {
        intervalRef.current = setInterval(() => {
          setProgress((p) => Math.min(100, p + 3 + Math.random() * 7));
        }, 170);
      }, 2500),
    ];
    return () => {
      timers.forEach(clearTimeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  // Stop the meter once it's full.
  useEffect(() => {
    if (progress >= 100 && intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, [progress]);

  // Hand off to the gate a beat after the build finishes.
  useEffect(() => {
    if (!done) return;
    const t = setTimeout(onComplete, 1400);
    return () => clearTimeout(t);
  }, [done, onComplete]);

  return (
    <>
      <KRow status={done ? "complete" : "in progress"} live />
      <h1 key={done ? "ready" : "run"} className="gk-headline">
        {done ? "handing this\nto you." : "running checks\nin the sandbox."}
      </h1>

      <Seg right={`${shown} / ${TRACE.length}`} />
      <Trace
        steps={TRACE}
        shown={shown}
        runningId={done ? undefined : "build"}
        progress={progress}
      />

      <Gate variant={done ? "open" : "ahead"} label={done ? "Your review →" : "Your review"} />
    </>
  );
}

/* ------------------------------------------------------------- waiting screen */

export function WaitingScreen({
  upgrades,
  selectedCount,
  tense,
  onToggle,
  onTenseChange,
  onApprove,
  onDecline,
}: {
  upgrades: Upgrade[];
  selectedCount: number;
  tense: boolean;
  onToggle: (id: string) => void;
  onTenseChange: (tense: boolean) => void;
  onApprove: () => void;
  onDecline: () => void;
}) {
  return (
    <>
      <KRow status="holding" />
      <h1 className="gk-headline">{"waiting for\nyour word."}</h1>

      <Seg right={`${TRACE.length} / ${TRACE.length} done`} />
      <Trace steps={TRACE} />

      <Gate variant="primed" tense={tense} label="The gate" />
      <p className="gk-lead">
        Choose what ships. Gatekeeper opens one pull request — and only after you say so.
      </p>

      <UpgradeLedger upgrades={upgrades} onToggle={onToggle} />

      <div className={selectedCount > 0 ? "gk-warn gk-warn--open" : "gk-warn"}>
        <WarningIcon />
        <span>
          Approving opens a pull request on <u>{REPO}</u> — the one step Gatekeeper can’t take
          back. Nothing merges without a second human review.
        </span>
      </div>

      <ApproveBar
        count={selectedCount}
        max={upgrades.length}
        onApprove={onApprove}
        onDecline={onDecline}
        onTenseChange={onTenseChange}
      />

      <div className="gk-locked">
        <div className="gk-locked__k">
          <LockIcon /> Locked until you approve
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Open pull request from {BRANCH}
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Post the audit summary as a PR comment
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- done screen */

export function DoneScreen({
  approved,
  skipped,
  onReset,
}: {
  approved: Upgrade[];
  skipped: Upgrade[];
  onReset: () => void;
}) {
  const count = approved.length;

  return (
    <>
      <KRow status="resolved" />
      <h1 className="gk-headline">{"the gate\nis open."}</h1>

      <Seg right={`${TRACE.length} / ${TRACE.length} done`} />
      <Trace steps={TRACE} />

      <Gate variant="open" label="Gate cleared — approved by you" />

      <div className="gk-manifest">
        <div>
          <b>PR #{PR_NUMBER}</b>&nbsp;&nbsp;{BRANCH} <i>→</i> main
        </div>
        <div>
          <span className="gk-add">+4</span> <span className="gk-del">−4</span>&nbsp;&nbsp;{count}{" "}
          {count === 1 ? "upgrade" : "upgrades"} · awaiting second review
        </div>
      </div>

      <div className="gk-resolved">
        {approved.map((u) => (
          <span key={u.id} className="gk-rr">
            <CheckIcon size={12} /> {u.name}{" "}
            <span className="gk-v">
              {u.from} → {u.to}
            </span>
          </span>
        ))}
        {skipped.map((u) => (
          <span key={u.id} className="gk-rr">
            <span className="gk-rr__d">—</span> {u.name}{" "}
            <span className="gk-v">held back · {u.risk} change</span>
          </span>
        ))}
      </div>

      <div className="gk-locked gk-locked--lit">
        <div className="gk-locked__k">Done</div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Pull request opened from {BRANCH}
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Audit summary posted as a PR comment
        </div>
      </div>

      <p className="gk-foot">
        Approved by you · just now. Gatekeeper will not merge, force-push, or touch main — a second
        reviewer owns that call.
      </p>
      <div className="gk-again">
        <button type="button" className="gk-decline" onClick={onReset}>
          ← Replay from the gate
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ declined screen */

export function DeclinedScreen({ onReset }: { onReset: () => void }) {
  return (
    <>
      <KRow status="closed" />
      <h1 className="gk-headline">{"held at\nthe gate."}</h1>

      <Seg right={`${TRACE.length} / ${TRACE.length} done`} />
      <Trace steps={TRACE} />

      <Gate variant="stop" label="Held at the gate — nothing opened" />

      <p className="gk-declined">
        The run is closed. No pull request, no branch, no change on {REPO}. Re-run the audit
        whenever you want another look.
      </p>
      <div className="gk-again">
        <button type="button" className="gk-decline" onClick={onReset}>
          ← Back to the gate
        </button>
      </div>
    </>
  );
}
