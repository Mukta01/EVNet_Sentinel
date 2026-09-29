"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { Server, ShieldCheck, Zap } from "lucide-react";

/** One real held-out flow and what the Random Forest called it. */
export type DemoFlow = { id: number; called: string; confidence: number | null };
export type DemoAttack = { label: string; cls: string; category: "dos" | "recon"; flows: DemoFlow[] };

const SCANS = new Set(["TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection", "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"]);
const pretty = (s: string) => s.replace(/_/g, " ");
const TONE = {
  dos: { fg: "#C4B5FD", bg: "rgba(167,139,250,0.14)", ring: "rgba(167,139,250,0.35)" },
  recon: { fg: "#FCD34D", bg: "rgba(245,158,11,0.14)", ring: "rgba(245,158,11,0.35)" },
};
const STATIONS = ["EVSE-A", "EVSE-B"] as const;

type Result = {
  key: number; attack: DemoAttack; flow: DemoFlow; station: (typeof STATIONS)[number];
  outcome: "named" | "category" | "flagged" | "slipped";
};

/**
 * A challenge on real data: drag an attack onto a charging station and try to
 * slip it past Sentinel. Each attempt replays a real held-out flow through the
 * Random Forest, so the score is the model's genuine behaviour.
 */
export default function BeatTheSentinel({ attacks }: { attacks: DemoAttack[] }) {
  const reduce = useReducedMotion();
  const [result, setResult] = useState<Result | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [hover, setHover] = useState<string | null>(null);
  const [score, setScore] = useState({ tries: 0, slipped: 0, misnamed: 0 });
  const stationRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cursor = useRef<Record<string, number>>({});
  const key = useRef(0);
  // A drag ends with a click event; don't let it launch a second time.
  const dragged = useRef(false);

  const launch = (attack: DemoAttack, station: Result["station"]) => {
    if (inFlight) return;
    // Walk each attack's flows with a stride co-prime to the pool, so repeated
    // tries show different real flows.
    const n = (cursor.current[attack.cls] ?? 0) + 1;
    cursor.current[attack.cls] = n;
    const flow = attack.flows[(n * 37) % attack.flows.length];
    const called = flow.called;
    const outcome: Result["outcome"] =
      called === "Benign" ? "slipped"
      : called === attack.cls ? "named"
      : SCANS.has(called) === (attack.category === "recon") ? "category"
      : "flagged";
    key.current += 1;
    setInFlight(true);
    setResult({ key: key.current, attack, flow, station, outcome });
    setTimeout(() => {
      setInFlight(false);
      setScore((s) => ({
        tries: s.tries + 1,
        slipped: s.slipped + (outcome === "slipped" ? 1 : 0),
        misnamed: s.misnamed + (outcome === "category" || outcome === "flagged" ? 1 : 0),
      }));
    }, reduce ? 0 : 1100);
  };

  const stationAt = (info: PanInfo) =>
    STATIONS.find((s) => {
      const r = stationRefs.current[s]?.getBoundingClientRect();
      return r && info.point.x >= r.left - 24 && info.point.x <= r.right + 24 &&
        info.point.y - window.scrollY >= r.top - 24 && info.point.y - window.scrollY <= r.bottom + 24;
    });

  const done = result && !inFlight;
  const blocked = result && result.outcome !== "slipped";

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-white">Can you get an attack past Sentinel?</p>
          <p className="mt-0.5 text-[13px] text-slate-400">Drag an attack onto a charging station — or tap it.</p>
        </div>
        <div className="flex gap-4 font-mono text-[12px]" aria-live="polite">
          <span className="text-slate-400">tries <b className="text-slate-100">{score.tries}</b></span>
          <span className="text-slate-400">got past <b className={score.slipped ? "text-rose-300" : "text-emerald-300"}>{score.slipped}</b></span>
          <span className="text-slate-400">misnamed <b className="text-amber-300">{score.misnamed}</b></span>
        </div>
      </div>

      {/* attack cards */}
      <div className="mt-5 flex flex-wrap gap-2.5" role="group" aria-label="Attacks">
        {attacks.map((a) => (
          <motion.button
            key={a.cls}
            type="button"
            drag={!reduce && !inFlight}
            dragSnapToOrigin
            dragElastic={0.9}
            whileDrag={{ scale: 1.08, zIndex: 20, boxShadow: `0 12px 30px -8px ${TONE[a.category].ring}` }}
            whileHover={{ y: -2 }}
            onDragStart={() => { dragged.current = true; }}
            onDrag={(_, info) => setHover(stationAt(info) ?? null)}
            onDragEnd={(_, info) => {
              const s = stationAt(info);
              setHover(null);
              if (s) launch(a, s);
            }}
            onClick={() => {
              if (dragged.current) { dragged.current = false; return; }
              launch(a, "EVSE-A");
            }}
            disabled={inFlight}
            className="relative cursor-grab touch-none rounded-lg px-3.5 py-2 text-[13px] font-medium ring-1 ring-inset active:cursor-grabbing disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            style={{ color: TONE[a.category].fg, background: TONE[a.category].bg, ["--tw-ring-color" as string]: TONE[a.category].ring }}
          >
            {a.label}
            <span className="ml-2 text-[10px] uppercase tracking-wider opacity-60">{a.category === "dos" ? "DoS" : "scan"}</span>
          </motion.button>
        ))}
      </div>

      {/* the network */}
      <div className="relative mt-6 h-44 rounded-xl border border-white/[0.06] bg-[#030814]/70">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1000 176" preserveAspectRatio="none" aria-hidden="true">
          <path d="M150 50 C 300 50, 350 88, 500 88" stroke="rgba(34,197,94,0.35)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M150 126 C 300 126, 350 88, 500 88" stroke="rgba(34,197,94,0.35)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
          <path d="M500 88 H 870" stroke="rgba(34,197,94,0.35)" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
        </svg>

        {STATIONS.map((s, i) => (
          <div
            key={s}
            ref={(el) => { stationRefs.current[s] = el; }}
            className={`absolute left-[4%] flex items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
              hover === s ? "scale-110 border-emerald-400 bg-emerald-500/15" : "border-white/10 bg-[#0b1220]"
            }`}
            style={{ top: i === 0 ? "14%" : "58%" }}
          >
            <Zap className="h-4 w-4 text-emerald-300" aria-hidden />
            <span className="text-[12px] text-slate-200">{s}</span>
          </div>
        ))}

        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center">
          <motion.div
            key={done ? result?.key : "idle"}
            initial={done && !reduce ? { scale: 0.85 } : false}
            animate={{ scale: 1 }}
            className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border-2 bg-[#052e1a]"
            style={{
              borderColor: done ? (blocked ? "#F43F5E" : "#FBBF24") : "#22C55E",
              boxShadow: done ? `0 0 40px -6px ${blocked ? "#F43F5E" : "#FBBF24"}` : "0 0 30px -10px #22C55E",
            }}
          >
            <ShieldCheck className="h-7 w-7 text-emerald-300" aria-hidden />
          </motion.div>
          <p className="mt-1 text-[11px] text-slate-400">Sentinel</p>
        </div>

        <div className="absolute right-[4%] top-1/2 flex -translate-y-1/2 flex-col items-center">
          <div className={`grid h-11 w-11 place-items-center rounded-xl border bg-[#0b1220] ${done && !blocked ? "border-amber-400 text-amber-300" : "border-white/10 text-slate-400"}`}>
            <Server className="h-5 w-5" aria-hidden />
          </div>
          <p className="mt-1 text-[11px] text-slate-400">CSMS</p>
        </div>

        <AnimatePresence>
          {result && inFlight && !reduce &&
            [0, 1, 2, 3, 4, 5].map((i) => (
              <motion.span
                key={`${result.key}-${i}`}
                className="absolute h-2.5 w-2.5 rounded-full"
                style={{ background: "#F43F5E", boxShadow: "0 0 12px #F43F5E", marginLeft: -5, marginTop: -5 }}
                initial={{ left: "16%", top: result.station === "EVSE-A" ? "28%" : "72%", opacity: 0 }}
                animate={
                  result.outcome === "slipped"
                    ? { left: ["16%", "50%", "88%"], top: [result.station === "EVSE-A" ? "28%" : "72%", "50%", "50%"], opacity: [0, 1, 1] }
                    : { left: ["16%", "47%", "47%"], top: [result.station === "EVSE-A" ? "28%" : "72%", "50%", "50%"], opacity: [0, 1, 0], scale: [1, 1, 3] }
                }
                transition={{ duration: 1, delay: i * 0.06, times: [0, 0.75, 1], ease: "easeOut" }}
                exit={{ opacity: 0 }}
              />
            ))}
        </AnimatePresence>
      </div>

      {/* verdict */}
      <div className="mt-4 min-h-[64px]" aria-live="polite">
        {!result ? (
          <p className="text-[13px] leading-relaxed text-slate-500">
            Every attempt replays a real flow the model never saw in training, and shows exactly what it decided.
          </p>
        ) : inFlight ? (
          <p className="font-mono text-[12px] text-slate-500">{result.attack.label} → {result.station} … Sentinel is inspecting flow #{result.flow.id}</p>
        ) : (
          <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Verdict r={result} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Verdict({ r }: { r: Result }) {
  const called = pretty(r.flow.called);
  const conf = r.flow.confidence != null ? ` · ${(r.flow.confidence * 100).toFixed(0)}% sure` : "";
  const copy = {
    named: { head: "Caught — and named exactly.", sub: `Sentinel identified it as ${called}.`, color: "#86EFAC" },
    category: { head: `Caught — but called it ${called}.`, sub: `It knew this was ${r.attack.category === "recon" ? "a scan" : "denial of service"}, not which one. The six nmap scans look almost identical at flow level.`, color: "#FCD34D" },
    flagged: { head: `Caught — but misread as ${called}.`, sub: `Blocked, in the wrong category. Scans are most often mistaken for Slowloris.`, color: "#FCD34D" },
    slipped: { head: "You got through!", sub: `The model waved this flow through as normal traffic. That is rare: under 0.1% of attack flows in testing.`, color: "#FDA4AF" },
  }[r.outcome];
  return (
    <div>
      <p className="text-[17px] font-semibold" style={{ color: copy.color }}>{copy.head}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{copy.sub}</p>
      <p className="mt-1 font-mono text-[11px] text-slate-600">flow #{r.flow.id} · Random Forest{conf} · {r.attack.label} → {r.station}</p>
    </div>
  );
}
