"use client";

import { useRef } from "react";
import FigureExport from "./FigureExport";

type Ranked = { feature: string; value: number };
export type Importance = {
  model: string;
  impurity: Ranked[];
  separability: Record<"dos" | "recon", { rows: number; classes: number; seed: number; features: Ranked[] }>;
};

const PANELS = [
  { key: "dos", title: "Naming a denial-of-service attack", color: "#C4B5FD" },
  { key: "recon", title: "Naming a scan", color: "#FCD34D" },
] as const;

const TOP = 8;
const ROW = 24;
const LABEL_W = 200;
const BAR_W = 190;
const PANEL_W = LABEL_W + BAR_W + 48;
const HEAD = 44;
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

/**
 * Why floods are solved and scans are not, as a property of the features
 * rather than of any model: how much of "which attack is this?" each feature
 * answers on its own, inside each category. Both panels share one axis so the
 * difference in scale is the finding.
 */
export default function FeatureSeparability({ importance }: { importance: Importance }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const height = HEAD + TOP * ROW + 30;
  const width = PANEL_W * 2 + 8;
  const best = {
    dos: importance.separability.dos.features[0]?.value ?? 0,
    recon: importance.separability.recon.features[0]?.value ?? 0,
  };

  return (
    <section aria-labelledby="separability-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="separability-heading" className="text-lg font-semibold tracking-tight text-white">
            One feature names a flood. No feature names a scan.
          </h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
            Within each category, the share of the uncertainty about <em>which</em> attack it is that a
            single feature removes on its own (mutual information over label entropy). The best feature
            settles {Math.round(best.dos * 100)}% of the question for floods and{" "}
            {Math.round(best.recon * 100)}% for scans. Nothing in these flow statistics separates the
            six nmap modes, so no model trained on them can.
          </p>
        </div>
        <FigureExport target={svgRef} name="feature-separability" />
      </div>

      <div className="mt-6 overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full min-w-[640px]" role="img"
             aria-label="Per-feature separability inside denial-of-service and reconnaissance flows" fontFamily={FONT}>
          {PANELS.map((panel, p) => {
            const x0 = p * (PANEL_W + 8);
            const data = importance.separability[panel.key];
            return (
              <g key={panel.key} transform={`translate(${x0}, 0)`}>
                <text x={0} y={16} fontSize={13} fill="#F1F5F9" fontWeight={600}>{panel.title}</text>
                <text x={0} y={32} fontSize={10.5} fill="#64748B">
                  {data.rows.toLocaleString()} held-out flows · {data.classes} classes
                </text>
                {[0, 0.5, 1].map((t) => (
                  <g key={t}>
                    <line x1={LABEL_W + t * BAR_W} x2={LABEL_W + t * BAR_W} y1={HEAD - 4} y2={HEAD + TOP * ROW}
                          stroke="rgba(255,255,255,0.07)" />
                    <text x={LABEL_W + t * BAR_W} y={HEAD + TOP * ROW + 16} fontSize={10} fill="#64748B"
                          textAnchor="middle">{t * 100}%</text>
                  </g>
                ))}
                {data.features.slice(0, TOP).map((f, i) => (
                  <g key={f.feature} transform={`translate(0, ${HEAD + i * ROW})`}>
                    <text x={LABEL_W - 10} y={ROW / 2 + 4} fontSize={10.5} textAnchor="end" fill="#CBD5E1"
                          fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">{f.feature}</text>
                    <rect x={LABEL_W} y={5} width={BAR_W} height={ROW - 10} rx={2} fill="rgba(255,255,255,0.03)" />
                    <rect x={LABEL_W} y={5} width={Math.max(1.5, f.value * BAR_W)} height={ROW - 10} rx={2}
                          fill={panel.color} fillOpacity={0.85} />
                    <text x={LABEL_W + Math.max(1.5, f.value * BAR_W) + 6} y={ROW / 2 + 4} fontSize={10.5}
                          fill="#E2E8F0" fontFamily="ui-monospace, SFMono-Regular, Menlo, monospace">
                      {(f.value * 100).toFixed(f.value < 0.1 ? 1 : 0)}%
                    </text>
                  </g>
                ))}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="mt-6 border-t border-white/8 pt-4">
        <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          What the Random Forest splits on most · all classes, mean over seeds
        </p>
        <ul className="mt-2 flex flex-wrap gap-x-5 gap-y-1.5">
          {importance.impurity.slice(0, 6).map((f) => (
            <li key={f.feature} className="font-mono text-xs text-slate-400">
              {f.feature} <span className="tabular-nums text-slate-200">{f.value.toFixed(3)}</span>
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs leading-relaxed text-slate-500">
          SYN counts, durations and byte counts lead — the kind of features that separate floods.
          The forest has nothing comparably strong to use for scans.
        </p>
      </div>
    </section>
  );
}
