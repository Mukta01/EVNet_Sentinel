"use client";

import { useEffect, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

/**
 * Where EVNet Sentinel sits, told as one continuous scene.
 *
 * The station and the management system hold their positions through all five
 * beats; only the link between them changes. That is the argument: the wire is
 * the product's whole territory.
 *
 * Beat 1 renders fully at rest, so the section reads without scrolling and a
 * screenshot of the page shows the scene rather than an empty stage.
 */

type Beat = {
  id: string;
  title: string;
  body: string;
  /** what is true of the wire during this beat */
  wire: "quiet" | "active" | "watched" | "breached" | "guarded";
  attacker: boolean;
  sentinel: boolean;
  vehicle: boolean;
};

const BEATS: Beat[] = [
  {
    id: "plug-in",
    title: "A car plugs in",
    body: "The vehicle and the charging station negotiate over ISO 15118 — identity, power, billing. This part happens on a cable, in public, at the kerbside.",
    wire: "quiet", attacker: false, sentinel: false, vehicle: true,
  },
  {
    id: "report-home",
    title: "The station reports home",
    body: "Over OCPP, the station tells its management system what it is doing: heartbeats, meter values, session starts. This is the link that runs the charging network.",
    wire: "active", attacker: false, sentinel: false, vehicle: true,
  },
  {
    id: "intruder",
    title: "Someone else is on the network",
    body: "A charging station sits on a shared wifi network in a car park. Anyone within range can reach the same link — and in the CICEVSE2024 testbed, a compromised vehicle can reach it through the charging cable itself.",
    wire: "active", attacker: true, sentinel: false, vehicle: true,
  },
  {
    id: "unwatched",
    title: "Nothing is watching the wire",
    body: "Port scans, floods and fingerprinting arrive on the same link as the legitimate OCPP traffic. To the management system, it is all just traffic.",
    wire: "breached", attacker: true, sentinel: false, vehicle: true,
  },
  {
    id: "sentinel",
    title: "Sentinel sits on the wire",
    body: "An inline tap between station and management system, classifying every flow as it passes. Volumetric floods are caught outright. Reconnaissance is where it gets hard — and that honest limit is what our reproduction measured.",
    wire: "guarded", attacker: true, sentinel: true, vehicle: true,
  },
];

const WIRE_TONE: Record<Beat["wire"], string> = {
  quiet: "rgba(148,163,184,0.45)",
  active: "#22C55E",
  watched: "#22C55E",
  breached: "#F43F5E",
  guarded: "#22C55E",
};

export default function Storyline() {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [active, setActive] = useState(0);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (reduceMotion) return;
    const onScroll = () => {
      const el = sectionRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const scrollable = rect.height - window.innerHeight;
      if (scrollable <= 0) return;
      const progress = Math.min(1, Math.max(0, -rect.top / scrollable));
      setActive(Math.min(BEATS.length - 1, Math.floor(progress * BEATS.length)));
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [reduceMotion]);

  // Reduced motion: every beat laid out at once, no scroll dependency.
  if (reduceMotion) {
    return (
      <section id="architecture" className="mx-auto max-w-5xl px-6 py-24">
        <Heading />
        <ol className="mt-12 space-y-10">
          {BEATS.map((beat, i) => (
            <li key={beat.id} className="grid gap-5 sm:grid-cols-[minmax(0,20rem)_1fr]">
              <Stage beat={beat} />
              <div>
                <p className="font-mono text-[11px] tabular-nums text-emerald-400/80">
                  {String(i + 1).padStart(2, "0")}
                </p>
                <h3 className="mt-1 text-xl font-semibold tracking-tight text-white">{beat.title}</h3>
                <p className="mt-2 max-w-prose text-[15px] leading-relaxed text-slate-400">{beat.body}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    );
  }

  const beat = BEATS[active];

  return (
    <section ref={sectionRef} id="architecture" className="relative" style={{ height: `${BEATS.length * 85}vh` }}>
      <div className="sticky top-0 flex min-h-screen items-center">
        <div className="mx-auto grid w-full max-w-6xl gap-10 px-6 py-16 lg:grid-cols-2 lg:items-center">
          <div>
            <Heading />
            <div className="mt-10 flex gap-2" role="tablist" aria-label="Story beats">
              {BEATS.map((b, i) => (
                <button
                  key={b.id} role="tab" aria-selected={i === active} aria-label={b.title}
                  onClick={() => {
                    const el = sectionRef.current;
                    if (!el) return;
                    const scrollable = el.offsetHeight - window.innerHeight;
                    window.scrollTo({
                      top: el.offsetTop + (scrollable * (i + 0.5)) / BEATS.length,
                      behavior: "smooth",
                    });
                  }}
                  className="group py-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                >
                  <span
                    className={`block h-0.5 w-10 rounded-full transition-colors ${
                      i === active ? "bg-emerald-400" : "bg-white/15 group-hover:bg-white/30"
                    }`}
                  />
                </button>
              ))}
            </div>

            <p className="mt-8 font-mono text-[11px] tabular-nums text-emerald-400/80">
              {String(active + 1).padStart(2, "0")} / {String(BEATS.length).padStart(2, "0")}
            </p>
            <h3 className="mt-2 text-2xl font-semibold tracking-tight text-white text-balance sm:text-3xl">
              {beat.title}
            </h3>
            <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-slate-400">{beat.body}</p>
          </div>

          <Stage beat={beat} large />
        </div>
      </div>
    </section>
  );
}

function Heading() {
  return (
    <>
      <h2 className="text-3xl font-semibold tracking-tight text-white text-balance sm:text-4xl">
        Everything a charging network says, it says over one wire
      </h2>
      <p className="mt-3 max-w-prose text-[15px] leading-relaxed text-slate-400">
        EVNet Sentinel watches that wire.
      </p>
    </>
  );
}

function Stage({ beat, large }: { beat: Beat; large?: boolean }) {
  const tone = WIRE_TONE[beat.wire];
  return (
    <svg
      viewBox="0 0 420 300"
      className={large ? "w-full" : "w-full max-w-xs"}
      role="img"
      aria-label={`${beat.title}. ${beat.body}`}
    >
      {/* the vehicle */}
      <g opacity={beat.vehicle ? 1 : 0.25} style={{ transition: "opacity .5s ease" }}>
        <rect x="18" y="196" width="96" height="46" rx="4" fill="rgba(167,139,250,0.10)" stroke="rgba(167,139,250,0.55)" />
        <text x="66" y="217" textAnchor="middle" fontSize="12" fill="#C4B5FD" fontFamily="ui-sans-serif, system-ui">Vehicle</text>
        <text x="66" y="231" textAnchor="middle" fontSize="8.5" fill="rgba(196,181,253,0.7)" fontFamily="ui-monospace, monospace">ISO 15118</text>
      </g>
      <line x1="114" y1="219" x2="150" y2="219" stroke="rgba(148,163,184,0.4)" strokeWidth="1.5" />

      {/* the station — never leaves the stage */}
      <rect x="150" y="196" width="110" height="46" rx="4" fill="rgba(34,197,94,0.10)" stroke="rgba(34,197,94,0.6)" />
      <text x="205" y="217" textAnchor="middle" fontSize="12" fill="#86EFAC" fontFamily="ui-sans-serif, system-ui">Charging station</text>
      <text x="205" y="231" textAnchor="middle" fontSize="8.5" fill="rgba(134,239,172,0.7)" fontFamily="ui-monospace, monospace">EVSE</text>

      {/* the management system — never leaves the stage */}
      <rect x="150" y="30" width="110" height="46" rx="4" fill="rgba(56,189,248,0.10)" stroke="rgba(56,189,248,0.6)" />
      <text x="205" y="51" textAnchor="middle" fontSize="12" fill="#7DD3FC" fontFamily="ui-sans-serif, system-ui">Management</text>
      <text x="205" y="65" textAnchor="middle" fontSize="8.5" fill="rgba(125,211,252,0.7)" fontFamily="ui-monospace, monospace">CSMS · OCPP</text>

      {/* the wire */}
      <line
        x1="205" y1="196" x2="205" y2="76"
        stroke={tone} strokeWidth={beat.wire === "breached" ? 3 : 2}
        style={{ transition: "stroke .55s ease, stroke-width .55s ease" }}
      />
      {beat.wire === "active" && (
        <circle r="3.5" fill="#22C55E">
          <animate attributeName="cy" values="196;76" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="cx" values="205;205" dur="1.8s" repeatCount="indefinite" />
        </circle>
      )}
      {beat.wire === "breached" && (
        <circle r="4" fill="#F43F5E">
          <animate attributeName="cy" values="196;76" dur="0.9s" repeatCount="indefinite" />
          <animate attributeName="cx" values="205;205" dur="0.9s" repeatCount="indefinite" />
        </circle>
      )}

      {/* the attacker */}
      <g opacity={beat.attacker ? 1 : 0} style={{ transition: "opacity .5s ease" }}>
        <rect x="306" y="118" width="96" height="42" rx="4" fill="none" stroke="#F43F5E" strokeDasharray="5 4" />
        <text x="354" y="137" textAnchor="middle" fontSize="11" fill="#FDA4AF" fontFamily="ui-sans-serif, system-ui">Attacker</text>
        <text x="354" y="150" textAnchor="middle" fontSize="8" fill="rgba(253,164,175,0.7)" fontFamily="ui-monospace, monospace">same network</text>
        <path d="M306,139 Q250,139 218,139" fill="none" stroke="#F43F5E" strokeWidth="1.5" strokeDasharray="4 3" />
      </g>

      {/* the tap */}
      <g opacity={beat.sentinel ? 1 : 0} style={{ transition: "opacity .55s ease" }}>
        <rect x="146" y="112" width="118" height="52" rx="5" fill="rgba(34,197,94,0.16)" stroke="#22C55E" strokeWidth="2" />
        <text x="205" y="133" textAnchor="middle" fontSize="12" fill="#86EFAC" fontWeight="600" fontFamily="ui-sans-serif, system-ui">EVNet Sentinel</text>
        <text x="205" y="148" textAnchor="middle" fontSize="8.5" fill="rgba(134,239,172,0.85)" fontFamily="ui-monospace, monospace">inline tap</text>
      </g>
    </svg>
  );
}
