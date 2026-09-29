"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Crosshair, SlidersHorizontal } from "lucide-react";
import BeatTheSentinel, { type DemoAttack } from "./BeatTheSentinel";
import TuneDetector, { type HeroTuning } from "./TuneDetector";

const MODES = [
  { id: "beat", label: "Beat the Sentinel", icon: Crosshair },
  { id: "tune", label: "Tune the detector", icon: SlidersHorizontal },
] as const;

/** The hero's hands-on card: a challenge and a control, both on real results. */
export default function HeroPlayground({ attacks, tuning }: { attacks: DemoAttack[]; tuning: HeroTuning }) {
  const [mode, setMode] = useState<(typeof MODES)[number]["id"]>("beat");

  return (
    <div className="mx-auto w-full max-w-4xl rounded-2xl border border-white/[0.08] bg-[#050b18]/85 text-left shadow-[0_0_80px_-24px_rgba(16,185,129,0.45)] backdrop-blur-md">
      <div className="flex gap-1 border-b border-white/[0.06] p-2" role="tablist" aria-label="Try Sentinel">
        {MODES.map((m) => {
          const on = mode === m.id;
          return (
            <button
              key={m.id}
              role="tab"
              aria-selected={on}
              onClick={() => setMode(m.id)}
              className={`relative flex items-center gap-2 rounded-lg px-4 py-2 text-[13px] font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                on ? "text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {on && <motion.span layoutId="hero-mode" className="absolute inset-0 rounded-lg bg-white/[0.07]" transition={{ type: "spring", stiffness: 420, damping: 34 }} />}
              <m.icon className="relative h-4 w-4" aria-hidden />
              <span className="relative">{m.label}</span>
            </button>
          );
        })}
      </div>
      <div className="p-5 sm:p-7" role="tabpanel">
        {mode === "beat" ? <BeatTheSentinel attacks={attacks} /> : <TuneDetector data={tuning} />}
      </div>
    </div>
  );
}
