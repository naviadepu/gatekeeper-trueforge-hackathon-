import { REPO } from "./data";

/**
 * The thin "instrument" frame with corner ticks and the mono labels pinned to
 * each edge — repo, run, harness, and the live state code. Purely decorative
 * chrome; it never moves between screens so the operator always knows where to
 * look.
 */
export function InstrumentFrame({ stateCode }: { stateCode: string }) {
  return (
    <>
      <div className="gk-frame">
        <span />
        <span />
        <span />
        <span />
      </div>
      <div className="gk-edge gk-edge--tl">
        <b>Gatekeeper</b>
        <br />
        Dependency gate
      </div>
      <div className="gk-edge gk-edge--tr">
        Repo&nbsp;&nbsp;{REPO}
        <br />
        Run 001 &nbsp;·&nbsp; sandbox &nbsp;·&nbsp; node 20
      </div>
      <div className="gk-edge gk-edge--bl">State &nbsp;·&nbsp; {stateCode}</div>
      <div className="gk-edge gk-edge--br">TrueForge harness</div>
      <div className="gk-edge gk-edge--left">Approval-gated dependency upgrades</div>
    </>
  );
}
