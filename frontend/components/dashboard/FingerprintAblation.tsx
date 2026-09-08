"use client";

import { motion, useReducedMotion } from "framer-motion";
import { FAMILY } from "./theme";

type Row = {
  timestamps: string;
  dstPort: string;
  total: number;
  recon: number;
  flood: number;
  isReference?: boolean;
};

const fmt = new Intl.NumberFormat("en-US");

/**
 * The 2x2 that corrected the attribution: reconnaissance traffic is held up by
 * two columns at once, and the reference pipeline happens to keep the wrong one.
 */
export default function FingerprintAblation({ rows }: { rows: Row[] }) {
  const reduceMotion = useReducedMotion();
  const maxRecon = Math.max(...rows.map((r) => r.recon));

  return (
    <section aria-labelledby="ablation-heading">
      <h3 id="ablation-heading" className="text-lg font-semibold tracking-tight text-white">
        Reconnaissance rests on two columns
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
        Identical feature set throughout; only the capture timestamps and{" "}
        <code className="font-mono text-slate-300">dst_port</code> are toggled,
        then rows are deduplicated. Each column is independently near-sufficient.
        Remove both and 1.72M reconnaissance flows become 6,821.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[36rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left">
              {["Timestamps", "dst_port", "Total rows", "Reconnaissance flows"].map((h) => (
                <th
                  key={h}
                  scope="col"
                  className="pb-3 pr-4 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, index) => (
              <tr
                key={`${row.timestamps}-${row.dstPort}`}
                className={`border-b border-white/5 ${
                  row.isReference ? "bg-amber-400/[0.06]" : ""
                }`}
              >
                <Cell value={row.timestamps} />
                <Cell value={row.dstPort} />
                <td className="py-3 pr-4 font-mono text-xs tabular-nums text-slate-400">
                  {fmt.format(row.total)}
                </td>
                <td className="py-3 pr-4">
                  <div className="flex items-center gap-3">
                    <div className="relative h-2 w-28 overflow-hidden rounded-full bg-white/[0.04]">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: FAMILY.recon.fill }}
                        initial={reduceMotion ? false : { width: 0 }}
                        animate={{ width: `${(row.recon / maxRecon) * 100}%` }}
                        transition={{
                          duration: 0.7,
                          delay: index * 0.08,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      />
                    </div>
                    <span className="font-mono text-xs tabular-nums text-slate-200">
                      {fmt.format(row.recon)}
                    </span>
                    {row.isReference && (
                      <span className="rounded bg-amber-400/15 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-amber-300">
                        Reference pipeline
                      </span>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mt-5 max-w-prose text-sm leading-relaxed text-slate-400">
        The highlighted row is the published preprocessing. It discards{" "}
        <code className="font-mono text-slate-300">dst_port</code>, the feature
        that legitimately identifies a port scan, and keeps the timestamp that
        identifies it only by recording time — so its 273,932 reconnaissance
        flows are separable by <em className="not-italic text-slate-200">when</em>{" "}
        they were captured rather than by what they did.
      </p>
    </section>
  );
}

function Cell({ value }: { value: string }) {
  const kept = value === "kept";
  return (
    <td className="py-3 pr-4">
      <span
        className={`inline-flex items-center gap-1.5 text-xs ${
          kept ? "text-slate-200" : "text-slate-500"
        }`}
      >
        <span
          aria-hidden
          className={`h-1.5 w-1.5 rounded-full ${kept ? "bg-slate-300" : "bg-slate-700"}`}
        />
        {value}
      </span>
    </td>
  );
}
