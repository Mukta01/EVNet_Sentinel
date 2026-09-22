"use client";

import { motion, useReducedMotion } from "framer-motion";
import { MODEL_COLOR, MODEL_LABEL } from "./theme";

type Probe = { feature: string; accuracy: number; legitimate: boolean };

const PROBE_NOTE: Record<string, string> = {
  bidirectional_first_seen_ms:
    "Capture fingerprint — an absolute wall-clock position that names the recording, not the traffic.",
  src_port:
    "Partial fingerprint — ephemeral ports are allocated near-sequentially, so they band within a capture.",
  dst_port:
    "Legitimate signal — a port scan is defined by sweeping destination ports.",
};
type Effect = { model: string; leaked: number; corrected: number };

/**
 * Why the corrected numbers are lower than the published ones.
 *
 * Two panels: what a single column recovers on its own, and what each model
 * loses once the leaking columns are gone. The first panel is the argument; the
 * second is the cost.
 */
export default function LeakEvidence({
  probes,
  effects,
  paperAccuracy,
}: {
  probes: Probe[];
  effects: Effect[];
  paperAccuracy: number;
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section aria-labelledby="leak-heading" className="grid gap-10 lg:grid-cols-2">
      <div>
        <h3 id="leak-heading" className="text-lg font-semibold tracking-tight text-white">
          What one column knows on its own
        </h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
          A decision tree given a single feature and nothing else, scored on the
          15-class target. Two of these columns identify the capture session
          rather than the traffic.
        </p>

        <ul className="mt-6 space-y-5">
          {probes.map((probe, index) => (
            <li key={probe.feature}>
              <div className="flex items-baseline justify-between gap-3">
                <code className="font-mono text-[13px] text-slate-200">
                  {probe.feature}
                </code>
                <span className="font-mono text-sm tabular-nums text-slate-100">
                  {probe.accuracy.toFixed(4)}
                </span>
              </div>
              <div className="relative mt-2 h-2 overflow-hidden rounded-full bg-white/[0.04]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    background: probe.legitimate ? "#38BDF8" : "#F43F5E",
                  }}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${probe.accuracy * 100}%` }}
                  transition={{ duration: 0.8, delay: index * 0.08, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
                {PROBE_NOTE[probe.feature] ??
                  (probe.legitimate ? "Legitimate signal." : "Capture fingerprint.")}
              </p>
            </li>
          ))}
        </ul>

        <p className="mt-6 border-t border-white/8 pt-4 text-sm text-slate-400">
          The published multiclass accuracy is{" "}
          <span className="font-mono tabular-nums text-slate-200">
            {paperAccuracy.toFixed(4)}
          </span>
          . A single timestamp column exceeds it.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-tight text-white">
          What each model loses without it
        </h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
          Macro-F1 before and after removing the six absolute timestamp columns.
          The linear models barely move — a hyperplane could never exploit a
          timestamp axis the way a tree can.
        </p>

        <div className="mt-6 space-y-6">
          {effects.map((effect, index) => {
            const delta = effect.corrected - effect.leaked;
            const left = Math.min(effect.leaked, effect.corrected);
            const width = Math.abs(delta);

            return (
              <div key={effect.model}>
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-slate-200">
                    {MODEL_LABEL[effect.model] ?? effect.model}
                  </span>
                  <span
                    className={`font-mono text-xs tabular-nums ${
                      delta < 0 ? "text-rose-300" : "text-emerald-300"
                    }`}
                  >
                    {delta > 0 ? "+" : ""}
                    {delta.toFixed(4)}
                  </span>
                </div>

                <div className="relative mt-3 h-8">
                  <div className="absolute inset-x-0 top-1/2 h-px -translate-y-1/2 bg-white/8" />
                  <motion.div
                    className="absolute top-1/2 h-[3px] -translate-y-1/2 rounded-full"
                    style={{
                      left: `${left * 100}%`,
                      background: delta < 0 ? "#F43F5E" : "#22C55E",
                    }}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${width * 100}%` }}
                    transition={{ duration: 0.7, delay: index * 0.1, ease: [0.16, 1, 0.3, 1] }}
                  />
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#050B1A] bg-slate-500"
                    style={{ left: `${effect.leaked * 100}%` }}
                    title={`Leaked ${effect.leaked.toFixed(4)}`}
                  />
                  <span
                    className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-[#050B1A]"
                    style={{
                      left: `${effect.corrected * 100}%`,
                      background: MODEL_COLOR[effect.model] ?? "#22C55E",
                    }}
                    title={`Corrected ${effect.corrected.toFixed(4)}`}
                  />
                </div>

                <div className="mt-1 flex justify-between font-mono text-[11px] tabular-nums text-slate-500">
                  <span>leaked {effect.leaked.toFixed(4)}</span>
                  <span>corrected {effect.corrected.toFixed(4)}</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
