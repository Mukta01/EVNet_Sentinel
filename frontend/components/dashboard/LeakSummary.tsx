"use client";

import { ArrowRight } from "lucide-react";

const TIMESTAMP_COLUMNS = [
  "bidirectional_first_seen_ms", "bidirectional_last_seen_ms",
  "src2dst_first_seen_ms", "src2dst_last_seen_ms",
  "dst2src_first_seen_ms", "dst2src_last_seen_ms",
];

/**
 * The contribution in one row: the published figure, what a single leaked
 * column scores on its own, and what an honest model scores once it is gone.
 * All three are multiclass accuracy, so they compare directly.
 */
export default function LeakSummary({
  paperAccuracy,
  probeAccuracy,
  corrected,
}: {
  paperAccuracy: number;
  probeAccuracy: number;
  corrected: { accuracy: number; macroF1: number; model: string };
}) {
  const stages = [
    {
      label: "Paper reports",
      value: paperAccuracy,
      note: "Multiclass accuracy, Makhmudov et al. (2025)",
      color: "#94A3B8",
    },
    {
      label: "One timestamp column alone",
      value: probeAccuracy,
      note: "A single decision tree given only bidirectional_first_seen_ms",
      color: "#F43F5E",
    },
    {
      label: "Leak removed",
      value: corrected.accuracy,
      note: `${corrected.model}, macro-F1 ${corrected.macroF1.toFixed(3)} — every class weighted equally`,
      color: "#22C55E",
    },
  ];

  return (
    <section aria-labelledby="leak-summary-heading">
      <h3 id="leak-summary-heading" className="text-lg font-semibold tracking-tight text-white">
        Why the published 98% was too good
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
        One column that records <em>when</em> a flow was captured beats the published model on its own.
        The model recognised the recording, not the attack.
      </p>

      <ol className="mt-6 grid gap-3 md:grid-cols-[1fr_auto_1fr_auto_1fr] md:items-stretch">
        {stages.map((s, i) => (
          <li key={s.label} className="contents">
            <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
              <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{s.label}</p>
              <p className="mt-2 font-mono text-3xl tabular-nums" style={{ color: s.color }}>
                {(s.value * 100).toFixed(1)}%
              </p>
              <p className="mt-1 text-xs leading-relaxed text-slate-500">{s.note}</p>
            </div>
            {i < stages.length - 1 && (
              <ArrowRight className="hidden h-4 w-4 self-center text-slate-600 md:block" aria-hidden />
            )}
          </li>
        ))}
      </ol>

      <details className="group mt-4 rounded-lg border border-white/8 bg-white/[0.015] px-4 py-3">
        <summary className="cursor-pointer text-sm text-slate-300 marker:text-slate-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
          Which columns leaked
        </summary>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs text-rose-300/85">Removed — absolute capture timestamps</p>
            <ul className="mt-1.5 space-y-0.5">
              {TIMESTAMP_COLUMNS.map((c) => (
                <li key={c}><code className="font-mono text-xs text-slate-300">{c}</code></li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-amber-300/85">Removed — partial fingerprint</p>
            <p className="mt-1.5"><code className="font-mono text-xs text-slate-300">src_port</code></p>
            <p className="mt-1.5 text-xs leading-relaxed text-slate-500">
              Ephemeral ports are handed out near-sequentially, so they band within one capture.
              <code className="mx-1 font-mono text-slate-400">dst_port</code>
              is kept: sweeping destination ports is what a port scan is.
            </p>
          </div>
        </div>
      </details>
    </section>
  );
}
