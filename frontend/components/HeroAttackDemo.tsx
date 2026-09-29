"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Laptop, Server, ShieldCheck, Zap } from "lucide-react";

/** One real held-out flow and what the Random Forest called it. */
export type DemoFlow = { id: number; called: string; confidence: number | null };
export type DemoAttack = { label: string; cls: string; category: "dos" | "recon" | "benign"; flows: DemoFlow[] };

const CATEGORY = {
  dos: { label: "Denial of service", fg: "#C4B5FD", bg: "rgba(167,139,250,0.14)" },
  recon: { label: "Reconnaissance", fg: "#FCD34D", bg: "rgba(245,158,11,0.14)" },
  benign: { label: "Normal traffic", fg: "#7DD3FC", bg: "rgba(56,189,248,0.14)" },
} as const;

const SCANS = new Set(["TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection", "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"]);
const pretty = (s: string) => s.replace(/_/g, " ");
const categoryOf = (cls: string) => (cls === "Benign" ? "benign" : SCANS.has(cls) ? "recon" : "dos");

type Run = { key: number; attack: DemoAttack; flow: DemoFlow };

/**
 * The hero's hands-on moment: pick an attack, watch it hit Sentinel, and see
 * the verdict the Random Forest actually gave on a real held-out flow.
 * Nothing is scripted — a scan that gets misnamed shows up misnamed.
 */
export default function HeroAttackDemo({ attacks }: { attacks: DemoAttack[] }) {
  const reduce = useReducedMotion();
  const [run, setRun] = useState<Run | null>(null);
  const [landed, setLanded] = useState(false);
  const [tally, setTally] = useState({ fired: 0, flagged: 0 });
  const key = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Step through each attack's flows with a stride co-prime to the pool size,
  // so repeated clicks show different flows without a random draw.
  const cursor = useRef<Record<string, number>>({});

  const fire = (attack: DemoAttack) => {
    const n = (cursor.current[attack.cls] ?? 0) + 1;
    cursor.current[attack.cls] = n;
    const flow = attack.flows[(n * 37) % attack.flows.length];
    key.current += 1;
    setLanded(false);
    setRun({ key: key.current, attack, flow });
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      setLanded(true);
      setTally((t) => ({
        fired: t.fired + 1,
        flagged: t.flagged + (attack.category !== "benign" && flow.called !== "Benign" ? 1 : 0),
      }));
    }, reduce ? 0 : 900);
  };

  const verdict = run ? describe(run) : null;
  const blocked = run && run.flow.called !== "Benign";
  const tone = run ? (run.attack.category === "benign" ? "#38BDF8" : "#F43F5E") : "#64748B";

  return (
    <div className="w-full max-w-3xl mx-auto rounded-2xl border border-white/[0.08] bg-[#050b18]/80 backdrop-blur-md p-5 sm:p-6 text-left shadow-[0_0_60px_-20px_rgba(16,185,129,0.35)]">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold text-white">Fire a test attack at Sentinel</p>
        <p className="font-mono text-[11px] text-slate-500">
          {tally.fired ? `${tally.fired} fired · ${tally.flagged} flagged` : "real held-out flows · CICEVSE2024"}
        </p>
      </div>

      {/* attack chips */}
      <div className="mt-4 flex flex-wrap gap-2" role="group" aria-label="Choose traffic to send">
        {attacks.map((a) => {
          const c = CATEGORY[a.category];
          const active = run?.attack.cls === a.cls;
          return (
            <button
              key={a.cls}
              type="button"
              onClick={() => fire(a)}
              className="rounded-full px-3 py-1.5 text-[12.5px] font-medium ring-1 ring-inset transition-all hover:-translate-y-0.5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              style={{
                color: c.fg,
                background: active ? c.bg.replace("0.14", "0.28") : c.bg,
                ["--tw-ring-color" as string]: active ? c.fg : "rgba(255,255,255,0.08)",
              }}
            >
              {a.label}
            </button>
          );
        })}
      </div>

      {/* the wire */}
      <div className="relative mt-6 h-16" aria-hidden="true">
        <div className="absolute left-[6%] right-[6%] top-1/2 h-px -translate-y-1/2 bg-gradient-to-r from-white/10 via-emerald-400/40 to-white/10" />
        <Node className="left-0" icon={run?.attack.category === "benign" ? <Zap className="h-4 w-4" /> : <Laptop className="h-4 w-4" />}
              label={run ? (run.attack.category === "benign" ? "Station" : "Attacker") : "Source"} color={tone} />
        <Node className="left-1/2 -translate-x-1/2" icon={<ShieldCheck className="h-5 w-5" />} label="Sentinel" color="#22C55E" big
              pulse={landed ? (blocked ? "#F43F5E" : "#22C55E") : undefined} pulseKey={run?.key} />
        <Node className="right-0" icon={<Server className="h-4 w-4" />} label="CSMS" color={landed && !blocked ? "#22C55E" : "#64748B"} />

        <AnimatePresence>
          {run && !reduce &&
            [0, 1, 2, 3, 4].map((i) => (
              <motion.span
                key={`${run.key}-${i}`}
                className="absolute top-1/2 h-2 w-2 -translate-y-1/2 rounded-full"
                style={{ background: tone, boxShadow: `0 0 10px ${tone}` }}
                initial={{ left: "8%", opacity: 0 }}
                animate={
                  blocked
                    ? { left: ["8%", "48%", "48%"], opacity: [0, 1, 0], scale: [1, 1, 2.6] }
                    : { left: ["8%", "50%", "90%"], opacity: [0, 1, 0], backgroundColor: [tone, tone, "#22C55E"] }
                }
                transition={{ duration: 1.3, delay: i * 0.08, times: [0, 0.65, 1], ease: "easeOut" }}
                exit={{ opacity: 0 }}
              />
            ))}
        </AnimatePresence>
      </div>

      {/* verdict */}
      <div className="mt-4 min-h-[72px]" aria-live="polite">
        {!run ? (
          <p className="text-[13px] leading-relaxed text-slate-500">
            Each chip sends a real flow the model never saw in training. The verdict is exactly what the
            Random Forest returned — including its mistakes.
          </p>
        ) : !landed ? (
          <p className="font-mono text-[12px] text-slate-500">Inspecting flow #{run.flow.id}…</p>
        ) : (
          verdict && (
            <motion.div initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <span className="rounded-md px-2 py-1 text-[11px] font-semibold uppercase tracking-wide" style={{ color: verdict.fg, background: verdict.bg }}>
                {verdict.badge}
              </span>
              <span className="text-[14px] text-slate-100">{verdict.line}</span>
              <span className="w-full font-mono text-[11px] text-slate-500">
                flow #{run.flow.id} · Random Forest
                {run.flow.confidence != null && ` · confidence ${(run.flow.confidence * 100).toFixed(0)}%`}
              </span>
            </motion.div>
          )
        )}
      </div>
    </div>
  );
}

function describe({ attack, flow }: Run) {
  const called = flow.called;
  if (attack.category === "benign") {
    return called === "Benign"
      ? { badge: "Passed", line: "Normal charging traffic — let through to the CSMS.", fg: "#86EFAC", bg: "rgba(34,197,94,0.14)" }
      : { badge: "False alarm", line: `Normal traffic, but flagged as ${pretty(called)}.`, fg: "#FDA4AF", bg: "rgba(244,63,94,0.14)" };
  }
  if (called === "Benign") {
    return { badge: "Missed", line: `${attack.label} slipped through as normal traffic.`, fg: "#FDA4AF", bg: "rgba(244,63,94,0.14)" };
  }
  if (called === attack.cls) {
    return { badge: "Named", line: `${attack.label} detected and named exactly.`, fg: "#86EFAC", bg: "rgba(34,197,94,0.14)" };
  }
  if (categoryOf(called) === attack.category) {
    return { badge: CATEGORY[attack.category].label, line: `Caught as ${CATEGORY[attack.category].label.toLowerCase()} — called it ${pretty(called)}.`, fg: "#FCD34D", bg: "rgba(245,158,11,0.14)" };
  }
  return { badge: "Flagged", line: `Blocked, but misread as ${pretty(called)}.`, fg: "#FCD34D", bg: "rgba(245,158,11,0.14)" };
}

function Node({ className, icon, label, color, big, pulse, pulseKey }: {
  className: string; icon: React.ReactNode; label: string; color: string; big?: boolean; pulse?: string; pulseKey?: number;
}) {
  return (
    <div className={`absolute top-1/2 -translate-y-1/2 flex flex-col items-center ${className}`}>
      <div
        className={`relative grid place-items-center rounded-xl border bg-[#0b1220] transition-colors ${big ? "h-12 w-12" : "h-9 w-9"}`}
        style={{ color, borderColor: `${color}66` }}
      >
        {pulse && (
          <motion.span
            key={pulseKey}
            className="absolute inset-0 rounded-xl"
            initial={{ boxShadow: `0 0 0 0 ${pulse}aa` }}
            animate={{ boxShadow: `0 0 0 18px ${pulse}00` }}
            transition={{ duration: 0.9 }}
          />
        )}
        {icon}
      </div>
      <span className="mt-1 text-[10.5px] text-slate-400">{label}</span>
    </div>
  );
}
