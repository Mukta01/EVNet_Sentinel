"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion, type PanInfo } from "framer-motion";
import { Car, Laptop, Network, ShieldCheck, Zap } from "lucide-react";

/** One real held-out flow: what the Random Forest called it, and its recorded route. */
export type DemoFlow = {
  id: number; called: string; confidence: number | null;
  station: "EVSE-A" | "EVSE-B"; sender: "kali" | "rpi" | "evcc";
};
export type DemoAttack = { label: string; cls: string; category: "dos" | "recon"; flows: DemoFlow[] };

const SCANS = new Set(["TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection", "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"]);
const pretty = (s: string) => s.replace(/_/g, " ");
const TONE = {
  dos: { fg: "#C4B5FD", bg: "rgba(167,139,250,0.14)", ring: "rgba(167,139,250,0.35)" },
  recon: { fg: "#FCD34D", bg: "rgba(245,158,11,0.14)", ring: "rgba(245,158,11,0.35)" },
};
const STATIONS = ["EVSE-A", "EVSE-B"] as const;
type Station = (typeof STATIONS)[number];
const SENDER = {
  kali: { label: "Kali PC on the wifi", icon: Laptop },
  rpi: { label: "Raspberry Pi on the wifi", icon: Laptop },
  evcc: { label: "Compromised car, via the cable", icon: Car },
};

// Positions on the board, in percent.
const AT = {
  origin: { x: 8, y: 50 },
  sw: { x: 46, y: 50 },
  sentinel: { x: 46, y: 86 },
  "EVSE-A": { x: 88, y: 24 },
  "EVSE-B": { x: 88, y: 76 },
};

type Result = {
  key: number; attack: DemoAttack; flow: DemoFlow; station: Station;
  /** the station the visitor aimed at, when the recording only covers the other one */
  aimed: Station | null;
  outcome: "named" | "category" | "flagged" | "unnoticed";
};

/**
 * A challenge on real data: aim an attack at a charging station and try to get
 * it past Sentinel unnoticed. The attack travels from the device that really
 * sent it to the station you chose; the switch mirrors a copy to Sentinel,
 * which raises an alert or doesn't. Each try replays a real held-out flow
 * recorded against that station, judged by the Random Forest.
 */
export default function BeatTheSentinel({ attacks }: { attacks: DemoAttack[] }) {
  const reduce = useReducedMotion();
  const [result, setResult] = useState<Result | null>(null);
  const [inFlight, setInFlight] = useState(false);
  const [hover, setHover] = useState<Station | null>(null);
  const [score, setScore] = useState({ tries: 0, unnoticed: 0, misnamed: 0 });
  const stationRefs = useRef<Record<string, HTMLDivElement | null>>({});
  const cursor = useRef<Record<string, number>>({});
  const key = useRef(0);
  // A drag ends with a click event; don't let it launch a second time.
  const dragged = useRef(false);

  const launch = (attack: DemoAttack, station: Station) => {
    if (inFlight) return;
    // Only flows recorded against the chosen station; fall back if it has none.
    const pool = attack.flows.filter((f) => f.station === station);
    const flows = pool.length ? pool : attack.flows;
    // Walk the pool with a stride co-prime to its size so repeated tries vary.
    const slot = `${attack.cls}-${station}`;
    const n = (cursor.current[slot] ?? 0) + 1;
    cursor.current[slot] = n;
    const flow = flows[(n * 37) % flows.length];
    const called = flow.called;
    const outcome: Result["outcome"] =
      called === "Benign" ? "unnoticed"
      : called === attack.cls ? "named"
      : SCANS.has(called) === (attack.category === "recon") ? "category"
      : "flagged";
    key.current += 1;
    setInFlight(true);
    setResult({ key: key.current, attack, flow, station: flow.station, aimed: flow.station !== station ? station : null, outcome });
    setTimeout(() => {
      setInFlight(false);
      setScore((s) => ({
        tries: s.tries + 1,
        unnoticed: s.unnoticed + (outcome === "unnoticed" ? 1 : 0),
        misnamed: s.misnamed + (outcome === "category" || outcome === "flagged" ? 1 : 0),
      }));
    }, reduce ? 0 : 1300);
  };

  const stationAt = (info: PanInfo) =>
    STATIONS.find((s) => {
      const r = stationRefs.current[s]?.getBoundingClientRect();
      const y = info.point.y - window.scrollY;
      return r && info.point.x >= r.left - 28 && info.point.x <= r.right + 28 && y >= r.top - 28 && y <= r.bottom + 28;
    });

  const done = result && !inFlight;
  const alerted = result && result.outcome !== "unnoticed";
  const sender = result ? SENDER[result.flow.sender] : SENDER.kali;
  const Origin = sender.icon;
  const target = result ? AT[result.station] : AT["EVSE-A"];

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <p className="text-lg font-semibold text-white">Can you attack a charging station without Sentinel noticing?</p>
          <p className="mt-0.5 text-[13px] text-slate-400">Drag an attack onto a station — or tap it to aim at EVSE-A.</p>
        </div>
        <div className="flex gap-4 font-mono text-[12px]" aria-live="polite">
          <span className="text-slate-400">tries <b className="text-slate-100">{score.tries}</b></span>
          <span className="text-slate-400">unnoticed <b className={score.unnoticed ? "text-rose-300" : "text-emerald-300"}>{score.unnoticed}</b></span>
          <span className="text-slate-400">misnamed <b className="text-amber-300">{score.misnamed}</b></span>
        </div>
      </div>

      {/* attack cards */}
      <div className="mt-5 flex flex-wrap gap-2.5" role="group" aria-label="Attacks">
        {attacks.map((a) => (
          <motion.button
            key={a.cls}
            type="button"
            drag={!reduce}
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
            aria-disabled={inFlight}
            className="relative cursor-grab touch-none rounded-lg px-3.5 py-2 text-[13px] font-medium ring-1 ring-inset active:cursor-grabbing aria-disabled:opacity-60 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
            style={{ color: TONE[a.category].fg, background: TONE[a.category].bg, ["--tw-ring-color" as string]: TONE[a.category].ring }}
          >
            {a.label}
            <span className="ml-2 text-[10px] uppercase tracking-wider opacity-60">{a.category === "dos" ? "DoS" : "scan"}</span>
          </motion.button>
        ))}
      </div>

      {/* the site network */}
      <div className="relative mt-6 h-52 rounded-xl border border-white/[0.06] bg-[#030814]/70">
        <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          <g fill="none" strokeWidth="1.5">
            <path d={`M${AT.origin.x} ${AT.origin.y} H${AT.sw.x}`} stroke="rgba(244,63,94,0.35)" strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
            {STATIONS.map((s) => (
              <path key={s} d={`M${AT.sw.x} ${AT.sw.y} C 64 ${AT.sw.y}, 70 ${AT[s].y}, ${AT[s].x} ${AT[s].y}`}
                stroke={result?.station === s && inFlight ? "rgba(244,63,94,0.6)" : "rgba(34,197,94,0.35)"} vectorEffect="non-scaling-stroke" />
            ))}
            <path d={`M${AT.sw.x} ${AT.sw.y} V${AT.sentinel.y}`} stroke="rgba(34,197,94,0.55)" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />
          </g>
        </svg>

        <Node at={AT.origin} label={result ? sender.label : "Attacker"} tone="#F43F5E"><Origin className="h-4 w-4" /></Node>
        <Node at={AT.sw} label="Switch" tone="#94A3B8"><Network className="h-4 w-4" /></Node>
        <span className="absolute font-mono text-[9.5px] text-emerald-400/80" style={{ left: `${AT.sw.x + 1.5}%`, top: "66%" }}>mirror copy</span>

        {/* Sentinel: raises an alert, or doesn't */}
        <div className="absolute -translate-x-1/2 -translate-y-1/2 text-center" style={{ left: `${AT.sentinel.x}%`, top: `${AT.sentinel.y}%` }}>
          <motion.div
            key={done ? result?.key : "idle"}
            initial={done && !reduce ? { scale: 0.8 } : false}
            animate={{ scale: 1 }}
            className="relative mx-auto flex items-center gap-1.5 rounded-xl border-2 bg-[#052e1a] px-2.5 py-1"
            style={{
              borderColor: done ? (alerted ? "#F43F5E" : "#475569") : "#22C55E",
              boxShadow: done && alerted ? "0 0 36px -4px #F43F5E" : "0 0 24px -10px #22C55E",
            }}
          >
            <ShieldCheck className="h-4 w-4 text-emerald-300" aria-hidden />
            <span className="text-[11px] font-semibold text-slate-100">Sentinel</span>
            {done && (
              <span className={`ml-1 rounded px-1.5 py-0.5 text-[10px] font-bold ${alerted ? "bg-rose-500/20 text-rose-200" : "bg-slate-500/25 text-slate-50"}`}>
                {alerted ? "ALERT" : "silent"}
              </span>
            )}
          </motion.div>
        </div>

        {STATIONS.map((s) => {
          const hit = result?.station === s && done;
          return (
            <div
              key={s}
              ref={(el) => { stationRefs.current[s] = el; }}
              className={`absolute flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-lg border px-3 py-2 transition-all ${
                hover === s ? "scale-110 border-emerald-400 bg-emerald-500/15"
                : hit ? "border-rose-400 bg-rose-500/10" : "border-white/10 bg-[#0b1220]"
              }`}
              style={{ left: `${AT[s].x}%`, top: `${AT[s].y}%` }}
            >
              <Zap className={`h-4 w-4 ${hit ? "text-rose-300" : "text-emerald-300"}`} aria-hidden />
              <span className="whitespace-nowrap text-[12px] text-slate-200">{s}</span>
            </div>
          );
        })}

        <AnimatePresence>
          {result && inFlight && !reduce && (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={`${result.key}-a${i}`}
                  className="absolute h-2.5 w-2.5 rounded-full"
                  style={{ background: "#F43F5E", boxShadow: "0 0 12px #F43F5E", marginLeft: -5, marginTop: -5 }}
                  initial={{ left: `${AT.origin.x + 3}%`, top: `${AT.origin.y}%`, opacity: 0 }}
                  animate={{
                    left: [`${AT.origin.x + 3}%`, `${AT.sw.x}%`, `${target.x - 6}%`],
                    top: [`${AT.origin.y}%`, `${AT.sw.y}%`, `${target.y}%`],
                    opacity: [0, 1, 0.9],
                  }}
                  transition={{ duration: 1.05, delay: i * 0.05, times: [0, 0.5, 1], ease: "easeInOut" }}
                  exit={{ opacity: 0 }}
                />
              ))}
              {/* the mirrored copy the IDS actually inspects */}
              <motion.span
                key={`${result.key}-copy`}
                className="absolute h-2 w-2 rounded-full bg-rose-300/80"
                style={{ marginLeft: -4, marginTop: -4 }}
                initial={{ left: `${AT.sw.x}%`, top: `${AT.sw.y}%`, opacity: 0 }}
                animate={{ top: [`${AT.sw.y}%`, `${AT.sw.y}%`, `${AT.sentinel.y - 8}%`], opacity: [0, 1, 0] }}
                transition={{ duration: 1.1, times: [0, 0.45, 1] }}
              />
            </>
          )}
        </AnimatePresence>
      </div>

      {/* verdict */}
      <div className="mt-4 min-h-[68px]" aria-live="polite">
        {!result ? (
          <p className="text-[13px] leading-relaxed text-slate-500">
            Each try replays a real attack flow recorded against that station — from the device that really sent it — and
            shows exactly what the detector decided.
          </p>
        ) : inFlight ? (
          <p className="font-mono text-[12px] text-slate-500">
            {result.attack.label}: {sender.label} → {result.station} … Sentinel is inspecting the mirrored copy of flow #{result.flow.id}
          </p>
        ) : (
          <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}>
            <Verdict r={result} />
          </motion.div>
        )}
      </div>
    </div>
  );
}

function Node({ at, label, tone, children }: { at: { x: number; y: number }; label: string; tone: string; children: React.ReactNode }) {
  return (
    <div className="absolute flex -translate-x-1/2 -translate-y-1/2 flex-col items-center" style={{ left: `${at.x}%`, top: `${at.y}%` }}>
      <div className="grid h-10 w-10 place-items-center rounded-xl border bg-[#0b1220]" style={{ color: tone, borderColor: `${tone}66` }}>
        {children}
      </div>
      <span className="mt-1 max-w-[7.5rem] text-center text-[10.5px] leading-tight text-slate-400">{label}</span>
    </div>
  );
}

function Verdict({ r }: { r: Result }) {
  const called = pretty(r.flow.called);
  const conf = r.flow.confidence != null ? ` · ${(r.flow.confidence * 100).toFixed(0)}% sure` : "";
  const copy = {
    named: { head: `ALERT — ${r.attack.label} on ${r.station}, named exactly.`, sub: "The operator gets the right name and the right playbook.", color: "#86EFAC" },
    category: { head: `ALERT — but it called it ${called}.`, sub: `It knew this was ${r.attack.category === "recon" ? "a scan" : "denial of service"}, not which one. The six nmap scans look almost identical at flow level.`, color: "#FCD34D" },
    flagged: { head: `ALERT — but misread as ${called}.`, sub: "An alert was raised, in the wrong category. Scans are most often mistaken for Slowloris.", color: "#FCD34D" },
    unnoticed: { head: "It went unnoticed.", sub: "The detector judged this flow normal traffic. That is rare: under 0.1% of attack flows in testing.", color: "#FDA4AF" },
  }[r.outcome];
  return (
    <div>
      <p className="text-[17px] font-semibold" style={{ color: copy.color }}>{copy.head}</p>
      <p className="mt-1 text-[13px] leading-relaxed text-slate-400">{copy.sub}</p>
      {r.aimed && (
        <p className="mt-1 text-[12px] text-sky-300/80">
          {r.attack.label} was only ever recorded against {r.station}, so it was replayed there rather than on {r.aimed}.
        </p>
      )}
      <p className="mt-1 font-mono text-[11px] text-slate-600">
        flow #{r.flow.id} · {SENDER[r.flow.sender].label} → {r.station} · Random Forest{conf}
      </p>
    </div>
  );
}
