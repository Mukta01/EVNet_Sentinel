"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Pause, Play, RotateCcw, SkipForward } from "lucide-react";
import { FAMILY, MODEL_COLOR, MODEL_LABEL, prettyClass, type Family } from "./theme";

type Verdict = { label: string; correct: boolean; confidence: number | null };
type Feature = { key: string; label: string; unit: string; value: number };
export type Flow = {
  id: number;
  trueLabel: string;
  group: Family;
  features: Feature[];
  predictions: Record<string, Verdict>;
};

const SPEEDS = [
  { label: "0.5×", ms: 1600 },
  { label: "1×", ms: 800 },
  { label: "4×", ms: 200 },
];

const formatValue = (value: number, unit: string) => {
  const rounded =
    Math.abs(value) >= 1000
      ? Math.round(value).toLocaleString("en-US")
      : Number.isInteger(value)
        ? String(value)
        : value.toFixed(2);
  return unit ? `${rounded} ${unit}` : rounded;
};

/**
 * Replays real held-out flows through the trained models.
 *
 * Every verdict shown was produced by the actual model at export time; the
 * component is a projector, not a predictor. Switching models re-scores the
 * flows already seen, so the same traffic can be compared across detectors
 * without restarting the run.
 */
export default function InferenceReplay({
  flows,
  models,
  provenance,
}: {
  flows: Flow[];
  models: string[];
  provenance: string;
}) {
  const reduceMotion = useReducedMotion();
  const [activeModel, setActiveModel] = useState(models[0]);
  const [cursor, setCursor] = useState(0); // flows processed so far
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState(1);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const advance = useCallback(() => {
    setCursor((current) => {
      if (current >= flows.length) {
        setPlaying(false);
        return current;
      }
      return current + 1;
    });
  }, [flows.length]);

  useEffect(() => {
    if (!playing) return;
    if (cursor >= flows.length) {
      setPlaying(false);
      return;
    }
    timer.current = setTimeout(advance, SPEEDS[speed].ms);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [playing, cursor, speed, advance, flows.length]);

  const seen = useMemo(() => flows.slice(0, cursor), [flows, cursor]);
  const current = cursor > 0 ? flows[cursor - 1] : null;

  const tally = useMemo(() => {
    const base = {
      total: 0,
      correct: 0,
      volumetric: { total: 0, correct: 0 },
      recon: { total: 0, correct: 0 },
    };
    for (const flow of seen) {
      const verdict = flow.predictions[activeModel];
      if (!verdict) continue;
      base.total += 1;
      if (verdict.correct) base.correct += 1;
      if (flow.group === "volumetric" || flow.group === "recon") {
        const bucket = base[flow.group];
        bucket.total += 1;
        if (verdict.correct) bucket.correct += 1;
      }
    }
    return base;
  }, [seen, activeModel]);

  const reset = () => {
    setPlaying(false);
    setCursor(0);
  };

  const rate = (part: { total: number; correct: number }) =>
    part.total === 0 ? null : part.correct / part.total;

  const overall = rate(tally);
  const finished = cursor >= flows.length;

  return (
    <section aria-labelledby="replay-heading" className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="max-w-2xl">
          <h2
            id="replay-heading"
            className="text-2xl font-semibold tracking-tight text-white text-balance"
          >
            Replay the traffic through each detector
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            {provenance} Switching models re-scores everything seen so far, so the
            same {flows.length} flows can be compared across detectors without
            restarting.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Active model"
          className="flex flex-wrap gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1"
        >
          {models.map((name) => {
            const selected = name === activeModel;
            return (
              <button
                key={name}
                role="radio"
                aria-checked={selected}
                onClick={() => setActiveModel(name)}
                className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                  selected ? "text-slate-950" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="replay-model-pill"
                    className="absolute inset-0 rounded-md"
                    style={{ background: MODEL_COLOR[name] }}
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
                <span className="relative">{MODEL_LABEL[name] ?? name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Transport */}
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-white/8 bg-white/[0.02] px-4 py-3">
        <button
          onClick={() => (finished ? reset() : setPlaying((p) => !p))}
          className="inline-flex items-center gap-2 rounded-md bg-emerald-500/12 px-3.5 py-2 text-sm font-medium text-emerald-300 ring-1 ring-inset ring-emerald-500/25 transition-colors hover:bg-emerald-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          {finished ? (
            <><RotateCcw className="h-4 w-4" aria-hidden />Replay</>
          ) : playing ? (
            <><Pause className="h-4 w-4" aria-hidden />Pause</>
          ) : (
            <><Play className="h-4 w-4" aria-hidden />Start</>
          )}
        </button>

        <button
          onClick={advance}
          disabled={finished}
          className="inline-flex items-center gap-2 rounded-md px-3 py-2 text-sm text-slate-300 transition-colors hover:bg-white/5 disabled:cursor-not-allowed disabled:text-slate-600 disabled:hover:bg-transparent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
        >
          <SkipForward className="h-4 w-4" aria-hidden />
          Step
        </button>

        <div className="flex gap-1 rounded-md border border-white/8 p-0.5">
          {SPEEDS.map((option, index) => (
            <button
              key={option.label}
              onClick={() => setSpeed(index)}
              aria-pressed={speed === index}
              className={`rounded px-2 py-1 font-mono text-[11px] tabular-nums transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                speed === index
                  ? "bg-white/10 text-slate-100"
                  : "text-slate-500 hover:text-slate-300"
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <div className="h-1 w-28 overflow-hidden rounded-full bg-white/[0.06]">
            <div
              className="h-full rounded-full bg-slate-400 transition-[width] duration-200"
              style={{ width: `${(cursor / flows.length) * 100}%` }}
            />
          </div>
          <span className="font-mono text-xs tabular-nums text-slate-400">
            {cursor} / {flows.length}
          </span>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
        {/* Flow inspector */}
        <div className="min-h-[22rem] rounded-lg border border-white/8 bg-white/[0.02] p-5">
          {current ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={current.id}
                initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={reduceMotion ? undefined : { opacity: 0 }}
                transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
              >
                <FlowCard flow={current} model={activeModel} />
              </motion.div>
            </AnimatePresence>
          ) : (
            <div className="flex h-full min-h-[20rem] flex-col items-center justify-center text-center">
              <p className="max-w-sm text-sm leading-relaxed text-slate-400">
                No flows processed yet. Press{" "}
                <span className="text-slate-200">Start</span> to stream held-out
                traffic through{" "}
                <span className="text-slate-200">
                  {MODEL_LABEL[activeModel] ?? activeModel}
                </span>
                , or <span className="text-slate-200">Step</span> to advance one
                flow at a time.
              </p>
            </div>
          )}
        </div>

        {/* Running score */}
        <div className="space-y-4">
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-5">
            <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
              Running accuracy
            </h3>
            <p className="mt-2 font-mono text-3xl tabular-nums text-white">
              {overall === null ? "—" : `${(overall * 100).toFixed(1)}%`}
            </p>
            <p className="mt-1 font-mono text-xs tabular-nums text-slate-500">
              {tally.correct} correct of {tally.total}
            </p>

            <div className="mt-5 space-y-3 border-t border-white/8 pt-4">
              {(["volumetric", "recon"] as const).map((group) => {
                const share = rate(tally[group]);
                const family = FAMILY[group];
                return (
                  <div key={group}>
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="text-xs text-slate-400">{family.label}</span>
                      <span className="font-mono text-xs tabular-nums text-slate-200">
                        {share === null ? "—" : `${(share * 100).toFixed(0)}%`}
                      </span>
                    </div>
                    <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
                      <div
                        className="h-full rounded-full transition-[width] duration-300"
                        style={{
                          width: `${(share ?? 0) * 100}%`,
                          background: family.stroke,
                        }}
                      />
                    </div>
                    <p className="mt-1 font-mono text-[10px] tabular-nums text-slate-600">
                      {tally[group].correct}/{tally[group].total}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>

          <RecentVerdicts flows={seen} model={activeModel} />
        </div>
      </div>
    </section>
  );
}

function FlowCard({ flow, model }: { flow: Flow; model: string }) {
  const verdict = flow.predictions[model];
  const family = FAMILY[flow.group];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="font-mono text-[11px] tabular-nums text-slate-500">
          flow #{flow.id}
        </span>
        <span
          className="rounded px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide"
          style={{ background: family.dim, color: family.stroke }}
        >
          {family.short}
        </span>
      </div>

      <dl className="mt-4 grid gap-x-6 gap-y-2 sm:grid-cols-2">
        {flow.features.map((feature) => (
          <div
            key={feature.key}
            className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5"
          >
            <dt className="text-xs text-slate-500">{feature.label}</dt>
            <dd className="font-mono text-xs tabular-nums text-slate-200">
              {formatValue(feature.value, feature.unit)}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className="rounded-md border border-white/8 px-4 py-3">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            Ground truth
          </p>
          <p className="mt-1.5 text-sm text-slate-100">{prettyClass(flow.trueLabel)}</p>
        </div>
        <div
          className="rounded-md px-4 py-3 ring-1 ring-inset"
          style={{
            background: verdict?.correct ? "rgba(34,197,94,0.08)" : "rgba(244,63,94,0.08)",
            borderColor: "transparent",
            boxShadow: "none",
            ["--tw-ring-color" as string]: verdict?.correct
              ? "rgba(34,197,94,0.28)"
              : "rgba(244,63,94,0.28)",
          }}
        >
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            {MODEL_LABEL[model] ?? model} predicted
          </p>
          <p
            className={`mt-1.5 text-sm ${
              verdict?.correct ? "text-emerald-200" : "text-rose-200"
            }`}
          >
            {verdict ? prettyClass(verdict.label) : "—"}
          </p>
          {verdict?.confidence != null && (
            <p className="mt-1 font-mono text-[11px] tabular-nums text-slate-500">
              confidence {(verdict.confidence * 100).toFixed(1)}%
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function RecentVerdicts({ flows, model }: { flows: Flow[]; model: string }) {
  const recent = flows.slice(-9).reverse();

  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-5">
      <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
        Recent verdicts
      </h3>
      {recent.length === 0 ? (
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Verdicts appear here as flows are processed.
        </p>
      ) : (
        <ul className="mt-3 space-y-1.5">
          {recent.map((flow) => {
            const verdict = flow.predictions[model];
            return (
              <li
                key={flow.id}
                className="flex items-center gap-2 font-mono text-[11px] tabular-nums"
              >
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: verdict?.correct ? "#22C55E" : "#F43F5E" }}
                />
                <span className="truncate text-slate-400">
                  {prettyClass(flow.trueLabel)}
                </span>
                {!verdict?.correct && verdict && (
                  <span className="ml-auto shrink-0 truncate text-rose-300/80">
                    → {prettyClass(verdict.label)}
                  </span>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
