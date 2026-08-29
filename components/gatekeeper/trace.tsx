import type { TraceRow } from "@/lib/trueforge/protocol";
import { CheckIcon, SpinnerIcon, WarningIcon } from "./icons";

type TraceProps = {
  /** The agent's real tool-call ledger, streamed from TrueForge. */
  rows: TraceRow[];
};

/**
 * The trace ledger — the running record of what the agent has done. Rows are
 * keyed by id so a newly-streamed row mounts fresh and plays its rise-in.
 * A hairline rail runs down the icon gutter.
 */
export function Trace({ rows }: TraceProps) {
  return (
    <div className="gk-trace">
      {rows.map((row) => {
        const running = row.status === "running";
        return (
          <div key={row.id} className={running ? "gk-trow gk-trow--now" : "gk-trow"}>
            <span className="gk-trow__i">
              {running ? (
                <SpinnerIcon className="gk-spin" />
              ) : row.status === "failed" ? (
                <WarningIcon />
              ) : (
                <CheckIcon />
              )}
            </span>
            <span className="gk-trow__t">
              <b>{row.verb}</b> {row.label}
            </span>
            <span className="gk-trow__m">{row.meta}</span>
          </div>
        );
      })}
    </div>
  );
}
