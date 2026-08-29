"use client";

import { useEffect, useRef } from "react";

export type Pulse = { key: number; kind: "tick" | "flash" | null };

/**
 * Every non-content layer of the screen: canvas weave, drifting fluid warp,
 * sun-print glow, film grain, vignette — plus two mouse-reactive layers
 * (`bloom` follows the cursor, `core` drifts gently against it).
 *
 * `pulse` is a bump-counter the parent increments to fire a one-shot flash:
 * "tick" on each checkbox toggle, "flash" when the gate opens.
 */
export function Atmosphere({ pulse }: { pulse: Pulse }) {
  const bloomRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let frame = 0;
    const onMove = (e: PointerEvent) => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const w = window.innerWidth || 1;
        const h = window.innerHeight || 1;
        const nx = e.clientX / w;
        const ny = e.clientY / h;
        bloomRef.current?.style.setProperty("--gk-mx", `${nx * 100}%`);
        bloomRef.current?.style.setProperty("--gk-my", `${ny * 100}%`);
        coreRef.current?.style.setProperty("--gk-px", `${(nx - 0.5) * -24}px`);
        coreRef.current?.style.setProperty("--gk-py", `${(ny - 0.5) * -24}px`);
      });
    };
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  const pulseClass =
    pulse.kind === "flash"
      ? "gk-bg__pulse gk-bg__pulse--flash"
      : pulse.kind === "tick"
        ? "gk-bg__pulse gk-bg__pulse--tick"
        : "gk-bg__pulse";

  return (
    <div className="gk-bg" aria-hidden>
      <div className="gk-bg__weave" />
      <div className="gk-bg__core" ref={coreRef} />
      <svg
        className="gk-bg__fluid"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
      >
        <defs>
          <filter id="gk-warp" x="-40%" y="-40%" width="180%" height="180%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.004 0.007"
              numOctaves={2}
              seed={11}
              result="n"
            />
            <feDisplacementMap
              in="SourceGraphic"
              in2="n"
              scale={170}
              xChannelSelector="R"
              yChannelSelector="G"
            >
              <animate
                attributeName="scale"
                values="140;205;140"
                dur="24s"
                repeatCount="indefinite"
              />
            </feDisplacementMap>
          </filter>
        </defs>
        <g filter="url(#gk-warp)" fill="none" stroke="#7189d8" strokeWidth={9}>
          <ellipse cx={1180} cy={170} rx={70} ry={70} />
          <ellipse cx={1180} cy={170} rx={175} ry={165} />
          <ellipse cx={1180} cy={170} rx={290} ry={270} />
          <ellipse cx={1180} cy={170} rx={420} ry={390} />
          <ellipse cx={1180} cy={170} rx={560} ry={520} />
          <ellipse cx={1180} cy={170} rx={710} ry={660} />
        </g>
      </svg>
      <div className="gk-bg__print" />
      <div className="gk-bg__bloom" ref={bloomRef} />
      <div key={pulse.key} className={pulseClass} />
      <div className="gk-bg__grain" />
      <div className="gk-bg__vig" />
      <div className="gk-ghost">gate.</div>
    </div>
  );
}
