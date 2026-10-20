"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";
import { HUBS, MAP_BOUNDS, WARDS } from "./story/mumbai";

/**
 * The hero's live city: Mumbai's wards with its charging hubs, each sending
 * heartbeats to the CSMS. Every few seconds an attack arcs in at one hub, the
 * hub turns red, and Sentinel's alert appears beside it. Illustrative, like
 * the scroll story it leads into: hub placements are real neighbourhoods,
 * not a survey of real stations, and the attack picks are random.
 */

const CSMS = { x: 1400, y: 150 };
const ATTACKS = ["SYN Flood", "UDP Flood", "Port Scan", "Stealth Scan", "Slowloris", "OS Fingerprinting"];
/** Where attacks come from: off the west coast, out of frame. */
const ORIGIN = { x: 760, y: 420 };
const link = (h: { x: number; y: number }) =>
  `M${h.x} ${h.y} Q ${(h.x + CSMS.x) / 2} ${Math.min(h.y, CSMS.y) - 40} ${CSMS.x} ${CSMS.y + 24}`;
const arc = (h: { x: number; y: number }) => `M${ORIGIN.x} ${ORIGIN.y} Q ${(ORIGIN.x + h.x) / 2} ${Math.min(ORIGIN.y, h.y) - 120} ${h.x} ${h.y}`;

type Strike = { id: number; hub: number; attack: string; at: number };

const clamp = (v: number) => Math.min(1, Math.max(0, v));
/** ms after launch: the arc lands at ARRIVE, the alert holds until FADE. */
const ARRIVE = 1100, FADE = 3000;

export default function HeroMap() {
  const reduce = useReducedMotion();
  const layer = useRef<SVGGElement>(null);
  const [strike, setStrike] = useState<Strike | null>(null);
  const [caught, setCaught] = useState(0);
  const [landed, setLanded] = useState(-1);
  const current = useRef<Strike | null>(null);

  // Heartbeats: one dot per hub travelling to the CSMS, staggered so the city pulses.
  useEffect(() => {
    if (reduce) return;
    const g = layer.current;
    if (!g) return;
    const paths = Array.from(g.querySelectorAll<SVGPathElement>("path[data-link]"));
    const dots = paths.map(() => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("r", "3");
      c.setAttribute("fill", "#38BDF8");
      g.appendChild(c);
      return c;
    });
    const lengths = paths.map((p) => p.getTotalLength());
    let raf = 0;
    const tick = (now: number) => {
      paths.forEach((p, i) => {
        const t = ((now / 3200) + i / paths.length) % 1;
        const pt = p.getPointAtLength(t * lengths[i]);
        dots[i].setAttribute("cx", String(pt.x));
        dots[i].setAttribute("cy", String(pt.y));
        dots[i].setAttribute("opacity", String(Math.sin(t * Math.PI)));
      });

      // The current strike: arc draws in, ring ripples out on landing, alert fades in and out.
      const k = current.current;
      const svg = g.ownerSVGElement;
      if (k && svg) {
        const age = now - k.at;
        const arcEl = svg.querySelector(".hm-arc");
        arcEl?.setAttribute("stroke-dashoffset", String(1 - clamp(age / ARRIVE)));
        arcEl?.setAttribute("stroke-opacity", String(age < ARRIVE ? 1 : 1 - 0.7 * clamp((age - ARRIVE) / 600)));
        const ring = clamp((age - ARRIVE) / 1400);
        const ringEl = svg.querySelector(".hm-ring");
        ringEl?.setAttribute("r", String(10 + ring * 26));
        ringEl?.setAttribute("opacity", String(age < ARRIVE ? 0 : 1 - ring));
        const alertOn = clamp((age - ARRIVE) / 250) * (1 - clamp((age - FADE) / 400));
        svg.querySelector(".hm-alert")?.setAttribute("opacity", String(alertOn));
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); dots.forEach((d) => d.remove()); };
  }, [reduce]);

  // Attacks: a new one every few seconds at a random hub.
  useEffect(() => {
    if (reduce) return;
    let id = 0;
    const fire = () => {
      id += 1;
      const next = { id, hub: Math.floor(Math.random() * HUBS.length), attack: ATTACKS[Math.floor(Math.random() * ATTACKS.length)], at: performance.now() };
      current.current = next;
      setStrike(next);
      const strikeId = id;
      window.setTimeout(() => { setCaught((n) => n + 1); setLanded(strikeId); }, ARRIVE);
    };
    const first = window.setTimeout(fire, 1200);
    const every = window.setInterval(fire, 3600);
    return () => { window.clearTimeout(first); window.clearInterval(every); };
  }, [reduce]);

  const hit = strike ? HUBS[strike.hub] : null;

  return (
    <div className="theme-dark-island relative h-full overflow-hidden rounded-2xl border border-white/[0.08] bg-[#030a17]">
      <svg viewBox="740 20 760 860" className="block h-full w-full" role="img" aria-label="Map of Mumbai's charging hubs reporting to a central CSMS, with attacks being detected">
        <defs>
          <radialGradient id="hm-glow" r="50%"><stop offset="0" stopColor="#22C55E" stopOpacity=".45" /><stop offset="1" stopColor="#22C55E" stopOpacity="0" /></radialGradient>
          <radialGradient id="hm-glowR" r="50%"><stop offset="0" stopColor="#F43F5E" stopOpacity=".6" /><stop offset="1" stopColor="#F43F5E" stopOpacity="0" /></radialGradient>
          <pattern id="hm-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="rgba(148,163,184,0.05)" /></pattern>
        </defs>
        <rect x="740" y="20" width="760" height="860" fill="url(#hm-grid)" />
        <text x="770" y="640" fill="#1E3A5F" fontSize="18" fontStyle="italic" letterSpacing="5">ARABIAN SEA</text>
        {WARDS.map((w) => (
          <path key={w.name} d={w.d} fill="rgba(20,83,45,0.22)" stroke="rgba(34,197,94,0.28)" strokeWidth="0.8" />
        ))}
        <text x={MAP_BOUNDS.x + MAP_BOUNDS.width - 20} y={MAP_BOUNDS.y + 30} fill="#E2E8F0" fontSize="18" fontWeight="700" letterSpacing="7" textAnchor="end">MUMBAI</text>

        <g ref={layer}>
          {HUBS.map((h) => (
            <path key={h.name} data-link d={link(h)} fill="none" stroke="#22C55E" strokeOpacity=".22" strokeDasharray="4 7" />
          ))}
        </g>

        <g transform={`translate(${CSMS.x} ${CSMS.y})`}>
          <circle r="80" fill="url(#hm-glow)" />
          <rect x="-62" y="-26" width="124" height="52" rx="10" fill="#0B1220" stroke="#22C55E" strokeOpacity=".5" />
          <text y="-2" textAnchor="middle" fill="#F8FAFC" fontSize="14" fontWeight="600">CSMS</text>
          <text y="15" textAnchor="middle" fill="#94A3B8" fontSize="10">{HUBS.length} hubs reporting</text>
        </g>

        {HUBS.map((h, i) => {
          const isHit = strike?.hub === i && landed === strike.id;
          return (
            <g key={h.name} transform={`translate(${h.x} ${h.y})`}>
              <circle r="18" fill={isHit ? "url(#hm-glowR)" : "url(#hm-glow)"} />
              <circle r="4.5" fill={isHit ? "#F43F5E" : "#86EFAC"} />
              <text x="9" y="4" fill="#94A3B8" fontSize="10.5">{h.name}</text>
            </g>
          );
        })}

        {strike && hit && (
          <g key={strike.id}>
            <path d={arc(hit)} pathLength={1} strokeDasharray="1" strokeDashoffset="1" fill="none" stroke="#F43F5E" strokeWidth="1.6" className="hm-arc" />
            <circle r="10" cx={hit.x} cy={hit.y} fill="none" stroke="#F43F5E" strokeWidth="2" opacity="0" className="hm-ring" />
            <g transform={`translate(${hit.x + 18} ${hit.y - 34})`} opacity="0" className="hm-alert">
              <rect width="168" height="40" rx="7" fill="#0B1220" stroke="#22C55E" strokeOpacity=".7" />
              <text x="10" y="16" fill="#86EFAC" fontSize="10.5" fontWeight="600" className="font-mono">⚠ DETECTED · {strike.attack}</text>
              <text x="10" y="31" fill="#94A3B8" fontSize="9.5">{hit.name} hub · alert sent</text>
            </g>
          </g>
        )}
      </svg>

      <div className="pointer-events-none absolute bottom-3 left-3 right-3 flex items-center justify-between font-mono text-[11px] text-slate-400">
        <span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-emerald-400 align-middle" />{HUBS.length} hubs online</span>
        <span>{reduce ? "illustration" : `${caught} attacks flagged · illustration`}</span>
      </div>
    </div>
  );
}
