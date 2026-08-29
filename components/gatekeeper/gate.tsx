export type GateVariant = "primed" | "ahead" | "open" | "stop";

/**
 * The gate — a luminous threshold the flow stops at. It breathes while
 * `primed`, tightens when `tense` (the operator is hovering Approve), goes
 * calm-green when `open`, dashed-coral when `stop`, and dim when it's still
 * `ahead` (the agent is working toward it).
 */
export function Gate({
  variant,
  label,
  tense = false,
  opening = false,
}: {
  variant: GateVariant;
  label: string;
  tense?: boolean;
  /** Play the one-shot "gate swings open" animation (used on the first click). */
  opening?: boolean;
}) {
  const cls = `gk-gate gk-gate--${variant}${tense ? " gk-gate--tense" : ""}${
    opening ? " gk-gate--opening" : ""
  }`;
  return (
    <div className={cls}>
      <span className="gk-gate__line" />
      <span className="gk-gate__tag">{label}</span>
      <span className="gk-gate__line" />
    </div>
  );
}
