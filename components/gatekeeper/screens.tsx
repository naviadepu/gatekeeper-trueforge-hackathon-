"use client";

import { BRANCH, REPO, type Upgrade } from "./data";
import type { PendingPr, TraceRow } from "@/lib/trueforge/protocol";
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

function stepCount(rows: TraceRow[]): string {
  if (rows.length === 0) return "no steps yet";
  const done = rows.filter((r) => r.status !== "running").length;
  return `${done} / ${rows.length} done`;
}

function Notes({ notes }: { notes: string[] }) {
  if (notes.length === 0) return null;
  return <p className="gk-lead">{notes[notes.length - 1]}</p>;
}

/* -------------------------------------------------------------- start screen */

export function StartScreen({
  repo,
  opening,
  onStart,
}: {
  repo: string;
  opening: boolean;
  onStart: () => void;
}) {
  return (
    <>
      <KRow status="idle" />
      <h1 className="gk-headline">{"ready when\nyou are."}</h1>

      <p className="gk-lead">
        Gatekeeper audits <u>{repo}</u> for vulnerable dependencies in a sandbox, then shows you
        exactly what it wants to change — before it opens a single pull request.
      </p>

      <Gate variant="primed" label={opening ? "Opening" : "Start the audit"} opening={opening} />

      <div className="gk-acts">
        <button
          type="button"
          className="gk-approve"
          disabled={opening}
          onClick={onStart}
        >
          {opening ? "Opening…" : `Audit ${repo.split("/").pop()}`}
        </button>
      </div>

      <div className="gk-locked">
        <div className="gk-locked__k">
          <LockIcon /> Nothing runs until you press the button
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Read package.json and run npm audit in a sandbox
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Open a pull request — only after you approve it
        </div>
      </div>
    </>
  );
}

/* ------------------------------------------------------------- working screen */

export function WorkingScreen({
  rows,
  notes,
  opening = false,
}: {
  rows: TraceRow[];
  notes: string[];
  opening?: boolean;
}) {
  return (
    <>
      <KRow status={opening ? "opening pr" : "auditing"} live />
      <h1 className="gk-headline">
        {opening ? "applying your\napproved set." : "running checks\nin the sandbox."}
      </h1>

      <Seg right={stepCount(rows)} />
      <Trace rows={rows} />
      <Notes notes={notes} />

      <Gate variant="ahead" label={opening ? "Toward the pull request" : "Your review"} />
    </>
  );
}

/* ------------------------------------------------------------- waiting screen */

export function WaitingScreen({
  upgrades,
  summary,
  selectedCount,
  rows,
  tense,
  busy,
  onToggle,
  onTenseChange,
  onApprove,
  onDecline,
}: {
  upgrades: Upgrade[];
  summary: string;
  selectedCount: number;
  rows: TraceRow[];
  tense: boolean;
  busy: boolean;
  onToggle: (id: string) => void;
  onTenseChange: (tense: boolean) => void;
  onApprove: () => void;
  onDecline: () => void;
}) {
  return (
    <>
      <KRow status="holding" />
      <h1 className="gk-headline">{"waiting for\nyour word."}</h1>

      <Seg right={stepCount(rows)} />
      <Trace rows={rows} />

      <Gate variant="primed" tense={tense} label="The gate" />
      <p className="gk-lead">
        {summary ? `${summary} ` : ""}
        Choose what ships. Gatekeeper opens one pull request — and only after you say so.
      </p>

      <UpgradeLedger upgrades={upgrades} onToggle={onToggle} />

      {upgrades.length > 0 && selectedCount === 0 && (
        <p className="gk-hint">Nothing is selected — toggle at least one upgrade to open a pull request.</p>
      )}

      <div className={selectedCount > 0 ? "gk-warn gk-warn--open" : "gk-warn"}>
        <WarningIcon />
        <span>
          Approving sends the selected upgrades to the agent, which opens a pull request on{" "}
          <u>{REPO}</u> — the one step it pauses to ask about. Nothing merges without a second human
          review.
        </span>
      </div>

      <ApproveBar
        count={selectedCount}
        max={upgrades.length}
        busy={busy}
        onApprove={onApprove}
        onDecline={onDecline}
        onTenseChange={onTenseChange}
      />

      <div className="gk-locked">
        <div className="gk-locked__k">
          <LockIcon /> Locked until you approve
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Apply the selected upgrades on {BRANCH}
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Open the pull request — with a final confirm from you
        </div>
      </div>
    </>
  );
}

/* ---------------------------------------------------------- confirming screen */

export function ConfirmScreen({
  pr,
  rows,
  notes,
  busy,
  onConfirm,
  onDecline,
}: {
  pr: PendingPr;
  rows: TraceRow[];
  notes: string[];
  busy: boolean;
  onConfirm: () => void;
  onDecline: () => void;
}) {
  return (
    <>
      <KRow status="awaiting confirm" live />
      <h1 className="gk-headline">{"one call\nfrom open."}</h1>

      <Seg right={stepCount(rows)} />
      <Trace rows={rows} />
      <Notes notes={notes} />

      <Gate variant="primed" tense label="TrueForge is holding at create_pull_request" />

      <p className="gk-lead">
        The agent prepared the branch and wants to open this pull request. It has stopped and is
        waiting for you.
      </p>

      <div className="gk-manifest">
        <div>
          <b>{pr.title}</b>
        </div>
        <div>
          {pr.head || BRANCH} <i>→</i> {pr.base || "main"}
        </div>
        {pr.body ? <div className="gk-pr-body">{pr.body}</div> : null}
      </div>

      <div className="gk-acts">
        <button type="button" className="gk-approve" disabled={busy} onClick={onConfirm}>
          {busy ? "Opening…" : "Confirm & open PR"}
        </button>
        <button type="button" className="gk-decline" disabled={busy} onClick={onDecline}>
          Cancel
        </button>
      </div>
    </>
  );
}

/* ---------------------------------------------------------------- done screen */

export function DoneScreen({
  approved,
  skipped,
  pr,
  rows,
  onReset,
}: {
  approved: Upgrade[];
  skipped: Upgrade[];
  pr: { url: string; number: number | null } | null;
  rows: TraceRow[];
  onReset: () => void;
}) {
  const count = approved.length;

  return (
    <>
      <KRow status={pr?.number ? `pr open · ${pr.number}` : "resolved"} />
      <h1 className="gk-headline">{"the gate\nis open."}</h1>

      <Seg right={stepCount(rows)} />
      <Trace rows={rows} />

      <Gate variant="open" label="Gate cleared — approved by you" />

      <div className="gk-manifest">
        <div>
          {pr ? (
            <a href={pr.url} target="_blank" rel="noreferrer">
              <b>{pr.number ? `PR #${pr.number}` : "Pull request"}</b>
            </a>
          ) : (
            <b>Pull request opened</b>
          )}
          &nbsp;&nbsp;{BRANCH} <i>→</i> main
        </div>
        <div>
          {count} {count === 1 ? "upgrade" : "upgrades"} applied · awaiting second review
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
          <span className="gk-ring" /> Upgrades applied on {BRANCH}
        </div>
        <div className="gk-locked__row">
          <span className="gk-ring" /> Pull request opened for a second human review
        </div>
      </div>

      <p className="gk-foot">
        Approved by you · just now. Gatekeeper will not merge, force-push, or touch main — a second
        reviewer owns that call.
      </p>
      <div className="gk-again">
        <button type="button" className="gk-decline" onClick={onReset}>
          ← Run another audit
        </button>
      </div>
    </>
  );
}

/* ------------------------------------------------------------ declined screen */

export function DeclinedScreen({ rows, onReset }: { rows: TraceRow[]; onReset: () => void }) {
  return (
    <>
      <KRow status="closed" />
      <h1 className="gk-headline">{"held at\nthe gate."}</h1>

      <Seg right={stepCount(rows)} />
      <Trace rows={rows} />

      <Gate variant="stop" label="Held at the gate — nothing opened" />

      <p className="gk-declined">
        The run is closed. No pull request, no branch pushed to {REPO}. Re-run the audit whenever you
        want another look.
      </p>
      <div className="gk-again">
        <button type="button" className="gk-decline" onClick={onReset}>
          ← Back to the start
        </button>
      </div>
    </>
  );
}

/* --------------------------------------------------------------- error screen */

export function ErrorScreen({ message, onReset }: { message: string; onReset: () => void }) {
  return (
    <>
      <KRow status="error" />
      <h1 className="gk-headline">{"the run\nstopped."}</h1>

      <Gate variant="stop" label="Run halted — nothing opened" />

      <p className="gk-declined">{message}</p>
      <div className="gk-again">
        <button type="button" className="gk-decline" onClick={onReset}>
          ← Back to the start
        </button>
      </div>
    </>
  );
}
