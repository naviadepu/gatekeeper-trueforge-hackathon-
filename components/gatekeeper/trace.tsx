import type { TraceStep } from "./data";
import { CheckIcon, SpinnerIcon } from "./icons";

type TraceProps = {
  steps: TraceStep[];
  /** How many rows to reveal — the working screen counts this up. Default: all. */
  shown?: number;
  /** Step id that is still running: shows a spinner + progress bar instead of a check. */
  runningId?: string;
  /** 0–100 progress for the running step. */
  progress?: number;
};

/**
 * The trace ledger — the running record of what the agent has done. Rows are
 * keyed by id so a newly-revealed row mounts fresh and plays its rise-in.
 * No box; a hairline rail runs down the icon gutter.
 */
export function Trace({ steps, shown = steps.length, runningId, progress = 0 }: TraceProps) {
  return (
    <div className="gk-trace">
      {steps.slice(0, shown).map((step) => {
        const running = step.id === runningId;
        return (
          <div key={step.id} className={running ? "gk-trow gk-trow--now" : "gk-trow"}>
            <span className="gk-trow__i">
              {running ? <SpinnerIcon className="gk-spin" /> : <CheckIcon />}
            </span>
            <span className="gk-trow__t">
              <b>{step.verb}</b> {step.label}
            </span>
            <span className="gk-trow__m">
              {running ? (
                <>
                  <span className="gk-pbar">
                    <span className="gk-pbar__f" style={{ width: `${progress}%` }} />
                  </span>
                  <span className="gk-pct">{Math.round(progress)}%</span>
                </>
              ) : (
                step.meta
              )}
            </span>
          </div>
        );
      })}
    </div>
  );
}
