"use client";

import { useState } from "react";

// ---- Types ----------------------------------------------------------------

type Risk = "patch" | "minor" | "major";

type Upgrade = {
  id: string;
  name: string;
  from: string;
  to: string;
  risk: Risk;
  note: string;
  selected: boolean;
};

type Step = {
  label: string;
  status: "done" | "running" | "pending";
};

type Phase = "doing" | "waiting" | "done";

// ---- Fake data (swap for real agent output later) --------------------------

const REPO = "naviadepu/portfolio-navi-deploy";

const INITIAL_STEPS: Step[] = [
  { label: "Read package.json — 34 dependencies", status: "done" },
  { label: "Ran npm audit in sandbox — 2 vulnerabilities", status: "done" },
  { label: "Ran build check in sandbox — passed", status: "running" },
];

const INITIAL_UPGRADES: Upgrade[] = [
  {
    id: "1",
    name: "lodash",
    from: "4.17.15",
    to: "4.17.21",
    risk: "patch",
    note: "Fixes prototype pollution advisory",
    selected: true,
  },
  {
    id: "2",
    name: "postcss",
    from: "8.4.14",
    to: "8.4.31",
    risk: "patch",
    note: "Fixes parsing advisory",
    selected: true,
  },
  {
    id: "3",
    name: "tailwindcss",
    from: "3.3.0",
    to: "3.4.1",
    risk: "minor",
    note: "Minor bump, no breaking changes listed",
    selected: true,
  },
  {
    id: "4",
    name: "next",
    from: "13.2.4",
    to: "14.0.0",
    risk: "major",
    note: "Major version — router changes may break your build",
    selected: false,
  },
];

// ---- Risk styling ----------------------------------------------------------

const riskStyles: Record<Risk, string> = {
  patch: "bg-emerald-500/10 text-emerald-300 border-emerald-500/20",
  minor: "bg-amber-500/10 text-amber-300 border-amber-500/20",
  major: "bg-rose-500/10 text-rose-300 border-rose-500/20",
};

// ---- Page ------------------------------------------------------------------

export default function Home() {
  const [phase, setPhase] = useState<Phase>("waiting");
  const [upgrades, setUpgrades] = useState<Upgrade[]>(INITIAL_UPGRADES);

  const selectedCount = upgrades.filter((u) => u.selected).length;

  function toggle(id: string) {
    setUpgrades((prev) =>
      prev.map((u) => (u.id === id ? { ...u, selected: !u.selected } : u))
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 p-8">
      <div className="mx-auto max-w-2xl">
        {/* Dev-only phase switcher — delete before you ship */}
        <div className="mb-8 flex gap-2 text-xs">
          {(["doing", "waiting", "done"] as Phase[]).map((p) => (
            <button
              key={p}
              onClick={() => setPhase(p)}
              className={`rounded px-3 py-1 ${
                phase === p ? "bg-indigo-600" : "bg-slate-800"
              }`}
            >
              {p}
            </button>
          ))}
        </div>

        <header className="mb-8">
          <h1 className="text-xl font-semibold">Gatekeeper</h1>
          <p className="text-sm text-slate-400">{REPO}</p>
        </header>

        {phase === "doing" && <Doing />}
        {phase === "waiting" && (
          <Waiting
            upgrades={upgrades}
            selectedCount={selectedCount}
            onToggle={toggle}
            onApprove={() => setPhase("done")}
          />
        )}
        {phase === "done" && <Done upgrades={upgrades} />}
      </div>
    </main>
  );
}

// ---- Screen 1: Doing -------------------------------------------------------

function Doing() {
  return (
    <section>
      <div className="mb-6 flex items-center gap-2">
        <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
        <span className="text-sm">Agent working</span>
      </div>

      <ol className="space-y-3">
        {INITIAL_STEPS.map((step, i) => (
          <li key={i} className="flex items-start gap-3 text-sm">
            <span className="mt-0.5">
              {step.status === "done" && (
                <span className="text-emerald-400">✓</span>
              )}
              {step.status === "running" && (
                <span className="inline-block h-3 w-3 animate-spin rounded-full border-2 border-indigo-400 border-t-transparent" />
              )}
            </span>
            <span
              className={
                step.status === "done" ? "text-slate-300" : "text-slate-100"
              }
            >
              {step.label}
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

// ---- Screen 2: Waiting (the hero screen) -----------------------------------

function Waiting({
  upgrades,
  selectedCount,
  onToggle,
  onApprove,
}: {
  upgrades: Upgrade[];
  selectedCount: number;
  onToggle: (id: string) => void;
  onApprove: () => void;
}) {
  return (
    <section>
      <div className="mb-6 flex items-center gap-2">
        <span className="h-2 w-2 rounded-full bg-amber-400" />
        <span className="text-sm">Waiting for your approval</span>
      </div>

      <p className="mb-3 text-xs uppercase tracking-wide text-slate-500">
        Proposed upgrades — {selectedCount} of {upgrades.length} selected
      </p>

      <div className="space-y-2">
        {upgrades.map((u) => (
          <label
            key={u.id}
            className={`flex cursor-pointer items-center gap-3 rounded-xl border p-4 transition ${
              u.risk === "major"
                ? "border-rose-500/30 bg-slate-900"
                : "border-slate-800 bg-slate-900"
            }`}
          >
            <input
              type="checkbox"
              checked={u.selected}
              onChange={() => onToggle(u.id)}
              className="h-4 w-4 accent-indigo-500"
            />
            <div className="flex-1">
              <div className="font-mono text-sm">
                {u.name}{" "}
                <span className="text-slate-500">
                  {u.from} → {u.to}
                </span>
              </div>
              <div
                className={`mt-0.5 text-xs ${
                  u.risk === "major" ? "text-rose-300" : "text-slate-400"
                }`}
              >
                {u.note}
              </div>
            </div>
            <span
              className={`rounded-full border px-2.5 py-1 text-xs capitalize ${
                riskStyles[u.risk]
              }`}
            >
              {u.risk}
            </span>
          </label>
        ))}
      </div>

      <div className="mt-6 flex items-start gap-2 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200">
        <span>⚠</span>
        <span>
          Approving opens a pull request on {REPO}. Nothing merges without a
          second approval.
        </span>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={onApprove}
          disabled={selectedCount === 0}
          className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium disabled:opacity-40"
        >
          Approve {selectedCount} upgrade{selectedCount === 1 ? "" : "s"}
        </button>
        <button className="rounded-lg border border-slate-700 px-4 py-2 text-sm">
          Reject
        </button>
      </div>
    </section>
  );
}

// ---- Screen 3: Done --------------------------------------------------------

function Done({ upgrades }: { upgrades: Upgrade[] }) {
  const approved = upgrades.filter((u) => u.selected);
  const skipped = upgrades.filter((u) => !u.selected);

  return (
    <section>
      <div className="mb-6 flex items-center gap-2">
        <span className="text-emerald-400">✓</span>
        <span className="text-sm">Completed</span>
      </div>

      <div className="space-y-2 text-sm">
        {approved.map((u) => (
          <div key={u.id} className="flex items-center gap-2">
            <span className="text-emerald-400">✓</span>
            <span className="font-mono">
              {u.name} {u.from} → {u.to}
            </span>
          </div>
        ))}
        {skipped.map((u) => (
          <div key={u.id} className="flex items-center gap-2 text-slate-500">
            <span>—</span>
            <span className="font-mono">{u.name} skipped</span>
          </div>
        ))}
      </div>

      <div className="mt-6 rounded-xl border border-slate-800 bg-slate-900 p-4">
        <a href="#" className="text-sm text-indigo-400 underline">
          View pull request #12
        </a>
        <p className="mt-1 text-xs text-slate-500">Approved by you · just now</p>
      </div>
    </section>
  );
}