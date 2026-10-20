"use client";

import { useEffect, useRef } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Decorative network behind the hero headline: thin links run in from both
 * edges and meet at the centre, with packets travelling along them. It's
 * purely visual, hidden on narrow screens and static under reduced motion.
 */

const W = 1600, H = 900, CX = 800, CY = 430;
/** Start heights on each edge; links curve into the centre. */
const ROWS = [120, 250, 380, 520, 650, 780];
const LINKS = ROWS.flatMap((y, i) => [
  `M0 ${y} C ${360} ${y}, ${520} ${CY + (i - 2.5) * 22}, ${CX - 230} ${CY + (i - 2.5) * 14}`,
  `M${W} ${y} C ${W - 360} ${y}, ${W - 520} ${CY + (i - 2.5) * 22}, ${CX + 230} ${CY + (i - 2.5) * 14}`,
]);

export default function HeroNetwork() {
  const reduce = useReducedMotion();
  const layer = useRef<SVGGElement>(null);

  useEffect(() => {
    if (reduce) return;
    const g = layer.current;
    if (!g) return;
    const paths = Array.from(g.querySelectorAll<SVGPathElement>("path"));
    const lengths = paths.map((p) => p.getTotalLength());
    // Two packets per link at different speeds and phases; a few are red attacks.
    const packets = paths.flatMap((_, i) => [0, 1].map((k) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      const attack = (i + k) % 7 === 3;
      c.setAttribute("r", attack ? "2.6" : "2");
      c.setAttribute("fill", attack ? "#F43F5E" : i % 2 ? "#38BDF8" : "#10B981");
      g.appendChild(c);
      return { c, i, speed: 5200 + ((i * 7 + k * 13) % 9) * 700, phase: (i * 0.37 + k * 0.5) % 1 };
    }));
    let raf = 0;
    const tick = (now: number) => {
      for (const k of packets) {
        const t = (now / k.speed + k.phase) % 1;
        const pt = paths[k.i].getPointAtLength(t * lengths[k.i]);
        k.c.setAttribute("cx", String(pt.x));
        k.c.setAttribute("cy", String(pt.y));
        k.c.setAttribute("opacity", String(Math.sin(t * Math.PI) * 0.9));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); packets.forEach((k) => k.c.remove()); };
  }, [reduce]);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      preserveAspectRatio="xMidYMid slice"
      className="pointer-events-none absolute inset-0 z-0 hidden h-full w-full min-[1100px]:block"
      aria-hidden
    >
      <defs>
        <linearGradient id="hn-fade-l" x1="0" x2="1"><stop offset="0" stopColor="#10B981" stopOpacity=".35" /><stop offset="1" stopColor="#10B981" stopOpacity="0" /></linearGradient>
        <linearGradient id="hn-fade-r" x1="1" x2="0"><stop offset="0" stopColor="#38BDF8" stopOpacity=".35" /><stop offset="1" stopColor="#38BDF8" stopOpacity="0" /></linearGradient>
      </defs>
      <g ref={layer}>
        {LINKS.map((d, i) => (
          <path key={i} d={d} fill="none" stroke={`url(#hn-fade-${i % 2 ? "r" : "l"})`} strokeWidth="1" />
        ))}
      </g>
    </svg>
  );
}
