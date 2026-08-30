/**
 * The intro. On page load a diamond traces itself in the dark, splits down the
 * middle, and its two halves swing apart — opening the gate onto the app.
 * One-shot, ~1.5s, CSS only. Skipped under prefers-reduced-motion (the veil
 * collapses instantly). Rendered by `Gatekeeper`, removed after it plays.
 */
export function BootGate() {
  return (
    <div className="gk-boot" aria-hidden>
      <svg className="gk-boot__mark" viewBox="0 0 200 200" fill="none">
        <polyline className="gk-boot__edge gk-boot__edge--l" points="100,14 14,100 100,186" />
        <polyline className="gk-boot__edge gk-boot__edge--r" points="100,14 186,100 100,186" />
        <line className="gk-boot__seam" x1="100" y1="6" x2="100" y2="194" />
      </svg>
      <span className="gk-boot__word">Gatekeeper</span>
    </div>
  );
}
