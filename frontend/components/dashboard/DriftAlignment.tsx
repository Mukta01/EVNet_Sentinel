"use client";

import { motion, useReducedMotion } from "framer-motion";

type Drift = {
  events: number;
  withinHundred: number;
  medianDistance: number;
  nullMean: number;
  nullStd: number;
  captures: number;
};

type StreamRow = {
  order: string;
  accuracy: number;
  weightedF1: number;
  events: number;
  minutes: number;
};

/**
 * The drift result, drawn as the comparison that carries it: what the detector
 * did against what chance would have done.
 */
export default function DriftAlignment({
  drift,
  streamOrder,
  paperEvents,
}: {
  drift: Drift;
  streamOrder: StreamRow[];
  paperEvents: number;
}) {
  const reduceMotion = useReducedMotion();
  const observedShare = drift.withinHundred / drift.events;
  const chanceShare = drift.nullMean / drift.events;

  return (
    <section aria-labelledby="drift-heading" className="grid gap-10 lg:grid-cols-2">
      <div>
        <h3 id="drift-heading" className="text-lg font-semibold tracking-tight text-white">
          The drift detector is finding file seams
        </h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
          ADWIN run prequentially over the full 1,921,182-instance stream in
          capture order. CICEVSE2024 is {drift.captures + 1} packet captures
          concatenated end to end, and each join is an abrupt distribution change
          by construction.
        </p>

        <div className="mt-7 space-y-6">
          <Gauge
            label="Drift events landing within 100 instances of a capture boundary"
            value={observedShare}
            caption={`${drift.withinHundred} of ${drift.events} events · median distance ${drift.medianDistance} instances`}
            color="#22C55E"
            delay={0}
            reduceMotion={!!reduceMotion}
          />
          <Gauge
            label="Expected if the same events were placed at random"
            value={chanceShare}
            caption={`${drift.nullMean.toFixed(1)} ± ${drift.nullStd.toFixed(1)} events · 2,000 draws`}
            color="#475569"
            delay={0.15}
            reduceMotion={!!reduceMotion}
          />
        </div>

        <p className="mt-6 border-t border-white/8 pt-4 text-sm leading-relaxed text-slate-400">
          Empirical <span className="font-mono text-slate-300">p &lt; 0.0005</span>.
          The events are not evidence that charging-station traffic evolves; they
          mark where one recording was stitched to the next.
        </p>
      </div>

      <div>
        <h3 className="text-lg font-semibold tracking-tight text-white">
          Ordering alone moves accuracy 44 points
        </h3>
        <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
          Same model, same 1.92M instances, leak-free features. In capture order
          consecutive flows share a label, so predicting “the same as recently”
          scores nearly perfectly.
        </p>

        <div className="mt-6 space-y-4">
          {streamOrder.map((row, index) => (
            <div
              key={row.order}
              className="rounded-lg border border-white/8 bg-white/[0.02] p-4"
            >
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-slate-200">{row.order}</span>
                <span className="font-mono text-lg tabular-nums text-white">
                  {row.accuracy.toFixed(4)}
                </span>
              </div>
              <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{ background: index === 0 ? "#F59E0B" : "#38BDF8" }}
                  initial={reduceMotion ? false : { width: 0 }}
                  animate={{ width: `${row.accuracy * 100}%` }}
                  transition={{ duration: 0.8, delay: index * 0.12, ease: [0.16, 1, 0.3, 1] }}
                />
              </div>
              <dl className="mt-3 flex flex-wrap gap-x-6 gap-y-1 font-mono text-[11px] tabular-nums text-slate-500">
                <div className="flex gap-1.5">
                  <dt>weighted F1</dt>
                  <dd className="text-slate-300">{row.weightedF1.toFixed(4)}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>drift events</dt>
                  <dd className="text-slate-300">{row.events}</dd>
                </div>
                <div className="flex gap-1.5">
                  <dt>wall clock</dt>
                  <dd className="text-slate-300">{row.minutes} min</dd>
                </div>
              </dl>
            </div>
          ))}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-slate-400">
          The shuffled run detects {streamOrder[1]?.events} events against the{" "}
          {paperEvents} reported in the paper — close enough to suggest the
          original stream was shuffled too.
        </p>
      </div>
    </section>
  );
}

function Gauge({
  label,
  value,
  caption,
  color,
  delay,
  reduceMotion,
}: {
  label: string;
  value: number;
  caption: string;
  color: string;
  delay: number;
  reduceMotion: boolean;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-4">
        <span className="max-w-[24rem] text-[13px] leading-snug text-slate-300">{label}</span>
        <span className="font-mono text-xl tabular-nums text-white">
          {(value * 100).toFixed(1)}%
        </span>
      </div>
      <div className="relative mt-2.5 h-2.5 overflow-hidden rounded-full bg-white/[0.04]">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{ background: color }}
          initial={reduceMotion ? false : { width: 0 }}
          animate={{ width: `${value * 100}%` }}
          transition={{ duration: 0.9, delay, ease: [0.16, 1, 0.3, 1] }}
        />
      </div>
      <p className="mt-1.5 font-mono text-[11px] tabular-nums text-slate-500">{caption}</p>
    </div>
  );
}
