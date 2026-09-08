"use client";

import { useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { FAMILY, MODEL_COLOR, MODEL_LABEL, prettyClass, type Family } from "./theme";

type ClassRow = {
  class: string;
  group: Family;
  support: number;
  models: Record<string, { f1: number; std: number }>;
};

type SupportControl = {
  solved: { class: string; support: number };
  unsolved: { class: string; support: number };
};

const count = new Intl.NumberFormat("en-US");

/**
 * The project's central finding, drawn once.
 *
 * Every class is one row; bar length is F1, the whisker is one standard
 * deviation across seeds. Rows are ordered so the denial-of-service family sits
 * above the reconnaissance family, which puts the entire argument in the shape
 * of the chart: a solid block against the right edge, then a cliff.
 */
export default function ClassSeparation({
  rows,
  models,
  control,
}: {
  rows: ClassRow[];
  models: string[];
  control: SupportControl;
}) {
  const [active, setActive] = useState(models[0]);
  const reduceMotion = useReducedMotion();

  const volumetric = rows.filter((r) => r.group === "volumetric");
  const recon = rows.filter((r) => r.group === "recon");
  const other = rows.filter((r) => r.group === "other");

  const mean = (list: ClassRow[]) =>
    list.length
      ? list.reduce((sum, r) => sum + r.models[active].f1, 0) / list.length
      : 0;

  const volumetricMean = mean(volumetric);
  const reconMean = mean(recon);

  // Volumetric first, then reconnaissance: the cliff between them is the point.
  // Low-rate and data-starved classes trail behind, visually separated, because
  // no claim is being made about them.
  const ordered = [...volumetric, ...recon, ...other];
  const cliffIndex = volumetric.length;
  const tailIndex = volumetric.length + recon.length;

  return (
    <section aria-labelledby="separation-heading">
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div className="max-w-2xl">
          <h2
            id="separation-heading"
            className="text-2xl font-semibold tracking-tight text-white text-balance"
          >
            Floods are solved. Reconnaissance is not.
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-400">
            Per-class F1 with leakage removed, averaged over three seeds. Whiskers
            are one standard deviation. The gap holds for every model, linear and
            non-linear alike, which makes it a property of the data rather than of
            model capacity.
          </p>
        </div>

        <div
          role="radiogroup"
          aria-label="Model"
          className="flex flex-wrap gap-1 rounded-lg border border-white/8 bg-white/[0.02] p-1"
        >
          {models.map((name) => {
            const selected = name === active;
            return (
              <button
                key={name}
                role="radio"
                aria-checked={selected}
                onClick={() => setActive(name)}
                className={`relative rounded-md px-3 py-1.5 text-xs font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                  selected ? "text-slate-950" : "text-slate-400 hover:text-slate-200"
                }`}
              >
                {selected && (
                  <motion.span
                    layoutId="separation-model-pill"
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

      <div className="mb-2 hidden justify-end gap-3 pr-[1px] sm:flex">
        <span className="w-14 text-right text-[10px] uppercase tracking-[0.14em] text-slate-600">
          F1
        </span>
        <span className="w-20 text-right text-[10px] uppercase tracking-[0.14em] text-slate-600">
          Flows
        </span>
      </div>

      <div className="grid gap-x-8 gap-y-1 sm:grid-cols-[minmax(0,13rem)_1fr]">
        {ordered.map((row, index) => {
          const { f1, std } = row.models[active];
          const family = FAMILY[row.group];
          const isCliff = index === cliffIndex || index === tailIndex;

          return (
            <div key={row.class} className="contents">
              <div
                className={`flex items-center justify-end gap-2 py-1.5 text-right ${
                  isCliff ? "mt-4 sm:mt-6" : ""
                }`}
              >
                <span className="truncate text-[13px] text-slate-300">
                  {prettyClass(row.class)}
                </span>
                <span
                  aria-hidden
                  className="h-1.5 w-1.5 shrink-0 rounded-full"
                  style={{ background: family.stroke }}
                />
              </div>

              <div
                className={`flex items-center gap-3 py-1.5 ${isCliff ? "mt-4 sm:mt-6" : ""}`}
              >
                <div className="relative h-5 flex-1 overflow-hidden rounded-[3px] bg-white/[0.03]">
                  <motion.div
                    className="absolute inset-y-0 left-0 rounded-[3px]"
                    style={{ background: family.fill }}
                    initial={reduceMotion ? false : { width: 0 }}
                    animate={{ width: `${f1 * 100}%` }}
                    transition={{
                      duration: 0.7,
                      delay: reduceMotion ? 0 : index * 0.025,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                  {std > 0.001 && (
                    <div
                      aria-hidden
                      className="absolute inset-y-0 flex items-center"
                      style={{
                        left: `${Math.max(0, (f1 - std) * 100)}%`,
                        width: `${Math.min(100, std * 200)}%`,
                      }}
                    >
                      <span className="h-px w-full bg-white/45" />
                    </div>
                  )}
                </div>
                <span className="w-14 shrink-0 font-mono text-xs tabular-nums text-slate-300">
                  {f1.toFixed(3)}
                </span>
                <span
                  className="hidden w-20 shrink-0 text-right font-mono text-[11px] tabular-nums text-slate-600 sm:block"
                  title={`${count.format(row.support)} flows in the dataset`}
                >
                  {count.format(row.support)}
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-9 rounded-lg border border-white/8 bg-white/[0.02] p-6">
        <p className="max-w-3xl text-[15px] leading-relaxed text-slate-300">
          The obvious objection is that reconnaissance simply has fewer examples.
          It does not.{" "}
          <span className="text-emerald-300">{prettyClass(control.solved.class)}</span>{" "}
          has{" "}
          <span className="font-mono tabular-nums text-slate-100">
            {count.format(control.solved.support)}
          </span>{" "}
          flows and scores{" "}
          <span className="font-mono tabular-nums text-slate-100">
            {(volumetric.find((r) => r.class === control.solved.class)?.models[active].f1 ?? 0).toFixed(3)}
          </span>
          .{" "}
          <span className="text-amber-300">{prettyClass(control.unsolved.class)}</span>{" "}
          has{" "}
          <span className="font-mono tabular-nums text-slate-100">
            {count.format(control.unsolved.support)}
          </span>{" "}
          flows and scores{" "}
          <span className="font-mono tabular-nums text-slate-100">
            {(recon.find((r) => r.class === control.unsolved.class)?.models[active].f1 ?? 0).toFixed(3)}
          </span>
          . Comparable support, opposite outcomes.
        </p>

        <dl className="mt-6 grid gap-px overflow-hidden rounded-md border border-white/8 bg-white/8 sm:grid-cols-3">
          {[
            {
              term: `${FAMILY.volumetric.label} mean F1`,
              value: volumetricMean.toFixed(3),
              tone: FAMILY.volumetric.text,
              note: `${volumetric.length} classes`,
            },
            {
              term: `${FAMILY.recon.label} mean F1`,
              value: reconMean.toFixed(3),
              tone: FAMILY.recon.text,
              note: `${recon.length} classes`,
            },
            {
              term: "Separation",
              value: (volumetricMean - reconMean).toFixed(3),
              tone: "text-slate-100",
              note: "every model",
            },
          ].map((item) => (
            <div key={item.term} className="bg-[#050B1A] px-5 py-4">
              <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                {item.term}
              </dt>
              <dd className={`mt-1.5 font-mono text-xl tabular-nums ${item.tone}`}>
                {item.value}
              </dd>
              <dd className="mt-0.5 text-[11px] text-slate-600">{item.note}</dd>
            </div>
          ))}
        </dl>

        <p className="mt-5 text-xs leading-relaxed text-slate-500">
          {other.length} further classes — {other.map((r) => prettyClass(r.class)).join(", ")} —
          are shown below the rule but excluded from both means. Three of them have
          fewer than 100 flows in the entire dataset, and Slowloris is a low-rate
          attack whose flows resemble neither group.
        </p>
      </div>
    </section>
  );
}
