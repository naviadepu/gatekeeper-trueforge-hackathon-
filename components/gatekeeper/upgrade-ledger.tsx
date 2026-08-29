import type { Upgrade } from "./data";
import { DiamondIcon } from "./icons";

/**
 * The interactive checklist. Each row is a real <button> (keyboard + screen
 * reader friendly) styled as a ledger line — hairline rule, no card. Selecting
 * one fills its diamond and lights the left tick.
 */
export function UpgradeLedger({
  upgrades,
  onToggle,
}: {
  upgrades: Upgrade[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="gk-ledger">
      {upgrades.map((u) => (
        <button
          key={u.id}
          type="button"
          className={u.selected ? "gk-lrow gk-lrow--on" : "gk-lrow"}
          aria-pressed={u.selected}
          onClick={() => onToggle(u.id)}
        >
          <span className="gk-lrow__i">
            <DiamondIcon filled={u.selected} />
          </span>
          <span className="gk-lrow__n">{u.name}</span>
          <span className="gk-lrow__v">
            {u.from}
            <i>→</i>
            {u.to}
          </span>
          <span className="gk-lrow__r" style={{ color: `var(--gk-${u.risk})` }}>
            {u.risk}
          </span>
          <span className="gk-lrow__note">{u.note}</span>
        </button>
      ))}
    </div>
  );
}
