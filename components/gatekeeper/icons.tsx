// Small inline SVGs. Stroke-based, 24-unit grid, all inherit `currentColor`
// so CSS controls the colour.

type IconProps = { size?: number; className?: string };

export function CheckIcon({ size = 13, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className}>
      <path
        d="M20 6 9 17l-5-5"
        stroke="currentColor"
        strokeWidth={2.6}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SpinnerIcon({ size = 15, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className}>
      <circle cx={12} cy={12} r={9} stroke="var(--gk-ink-14)" strokeWidth={2.2} />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" />
    </svg>
  );
}

/**
 * A rotated square used as the mark inside a toggle cell. Unselected: a faint
 * outline — the empty slot. Selected: a solid, full-strength diamond.
 */
export function DiamondIcon({ filled, size = 15 }: IconProps & { filled: boolean }) {
  return (
    <svg viewBox="0 0 20 20" width={size} height={size}>
      <rect
        x={4.2}
        y={4.2}
        width={11.6}
        height={11.6}
        transform="rotate(45 10 10)"
        fill="none"
        stroke="currentColor"
        strokeWidth={1.6}
        style={{ opacity: filled ? 0.35 : 0.55 }}
      />
      <rect
        x={5.5}
        y={5.5}
        width={9}
        height={9}
        transform="rotate(45 10 10)"
        fill="currentColor"
        style={{ opacity: filled ? 1 : 0 }}
      />
    </svg>
  );
}

export function WarningIcon({ size = 14, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className}>
      <path
        d="M12 9v4m0 4h.01M10.3 3.9 2 18a2 2 0 0 0 1.7 3h16.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth={1.7}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function LockIcon({ size = 11, className }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" width={size} height={size} fill="none" className={className}>
      <rect x={5} y={11} width={14} height={10} rx={1.5} stroke="currentColor" strokeWidth={1.7} />
      <path d="M8 11V8a4 4 0 0 1 8 0v3" stroke="currentColor" strokeWidth={1.7} />
    </svg>
  );
}
