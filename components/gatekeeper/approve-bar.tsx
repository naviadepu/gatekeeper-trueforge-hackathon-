/**
 * Approve / Decline. The count in the Approve label is a mechanical odometer:
 * a vertical strip of digits that slides so the current one shows through a
 * 1em window. `max` is how many digits to render (the number of upgrades).
 */
export function ApproveBar({
  count,
  max,
  onApprove,
  onDecline,
  onTenseChange,
}: {
  count: number;
  max: number;
  onApprove: () => void;
  onDecline: () => void;
  onTenseChange: (tense: boolean) => void;
}) {
  const noun = count === 1 ? "upgrade" : "upgrades";

  return (
    <div className="gk-acts">
      <button
        type="button"
        className="gk-approve"
        disabled={count === 0}
        onClick={onApprove}
        onMouseEnter={() => onTenseChange(true)}
        onMouseLeave={() => onTenseChange(false)}
        onFocus={() => onTenseChange(true)}
        onBlur={() => onTenseChange(false)}
      >
        Approve{" "}
        <span className="gk-odo">
          <span className="gk-odo__s" style={{ transform: `translateY(-${count}em)` }}>
            {Array.from({ length: max + 1 }, (_, d) => (
              <span key={d} className="gk-odo__d">
                {d}
              </span>
            ))}
          </span>
        </span>{" "}
        {noun}
      </button>
      <button type="button" className="gk-decline" onClick={onDecline}>
        Decline
      </button>
    </div>
  );
}
