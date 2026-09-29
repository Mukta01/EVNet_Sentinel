"use client";

import { useMemo, useRef, useState } from "react";
import FigureExport from "./FigureExport";
import { MODEL_LABEL, prettyClass } from "./theme";

export type Confusion = {
  labels: string[];
  categories: Record<string, "dos" | "recon" | "benign">;
  models: Record<string, { rate: number[][]; count: number[][] }>;
};

const CATEGORY_LABEL = { dos: "Denial of service", recon: "Reconnaissance", benign: "Normal" };
const CATEGORY_COLOR = { dos: "#C4B5FD", recon: "#FCD34D", benign: "#7DD3FC" };

const CELL = 30;
const LEFT = 168;
const TOP = 150;
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

/**
 * Where each attack's flows end up. The diagonal is "named correctly"; anything
 * off it is a confusion. Errors are drawn on a stretched scale so a 5% leak is
 * still visible next to a 100% diagonal.
 */
export default function ConfusionExplorer({ confusion, seeds }: { confusion: Confusion; seeds: number[] }) {
  const models = Object.keys(confusion.models);
  const [model, setModel] = useState(models[0]);
  const [hover, setHover] = useState<[number, number] | null>(null);
  const svgRef = useRef<SVGSVGElement>(null);

  const { labels, categories } = confusion;
  const rate = confusion.models[model].rate;
  const count = confusion.models[model].count;
  const n = labels.length;
  const size = { w: LEFT + n * CELL + 12, h: TOP + n * CELL + 12 };

  // Block edges between categories, for the separator lines.
  const edges = labels
    .map((l, i) => (i > 0 && categories[l] !== categories[labels[i - 1]] ? i : -1))
    .filter((i) => i > 0);
  const blocks = useMemo(() => {
    const out: { cat: keyof typeof CATEGORY_LABEL; start: number; end: number }[] = [];
    labels.forEach((l, i) => {
      const cat = categories[l];
      if (out.length && out[out.length - 1].cat === cat) out[out.length - 1].end = i + 1;
      else out.push({ cat, start: i, end: i + 1 });
    });
    return out;
  }, [labels, categories]);

  const worst = useMemo(() => {
    const cells: { from: string; to: string; share: number; crosses: boolean }[] = [];
    rate.forEach((row, i) =>
      row.forEach((v, j) => {
        if (i !== j && v >= 0.02)
          cells.push({ from: labels[i], to: labels[j], share: v,
                       crosses: categories[labels[i]] !== categories[labels[j]] });
      }),
    );
    return cells.sort((a, b) => b.share - a.share).slice(0, 6);
  }, [rate, labels, categories]);

  // The two patterns the caption names, measured for the selected model: the
  // scan every other scan collapses into, and the share lost to Slowloris.
  const pattern = useMemo(() => {
    const scans = labels.map((l, i) => [l, i] as const).filter(([l]) => categories[l] === "recon");
    const sink = new Map<string, number>();
    scans.forEach(([, i]) => scans.forEach(([l, j]) => {
      if (i !== j) sink.set(l, (sink.get(l) ?? 0) + rate[i][j]);
    }));
    const top = [...sink.entries()].sort((a, b) => b[1] - a[1])[0]?.[0];
    const topIdx = labels.indexOf(top ?? "");
    const others = scans.filter(([l]) => l !== top).map(([, i]) => rate[i][topIdx]);
    const slow = labels.indexOf("Slowloris_Scan");
    const slowShares = slow >= 0 ? scans.map(([, i]) => rate[i][slow]) : [];
    return {
      sink: top, sinkMax: Math.max(...others),
      slowMin: Math.min(...slowShares), slowMax: Math.max(...slowShares),
    };
  }, [labels, categories, rate]);

  const readout = hover
    ? (() => {
        const [i, j] = hover;
        const total = count[i].reduce((a, b) => a + b, 0);
        return i === j
          ? `${prettyClass(labels[i])}: ${(rate[i][j] * 100).toFixed(1)}% named correctly (${count[i][j].toLocaleString()} of ${total.toLocaleString()} flows over ${seeds.length} seeds)`
          : `Of ${prettyClass(labels[i])} flows, ${(rate[i][j] * 100).toFixed(1)}% were called ${prettyClass(labels[j])} (${count[i][j].toLocaleString()} flows)`;
      })()
    : "Hover a cell to read it.";

  return (
    <section aria-labelledby="confusion-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="confusion-heading" className="text-lg font-semibold tracking-tight text-white">
            Where each attack&rsquo;s flows end up
          </h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
            Rows are the true attack, columns what the model called it, averaged over seeds{" "}
            {seeds.join(", ")}. The flood block is a clean diagonal. The scan block is a smear: with{" "}
            {MODEL_LABEL[model] ?? model}, the other scans collapse into{" "}
            {pattern.sink ? prettyClass(pattern.sink) : "one another"} (up to{" "}
            {Math.round(pattern.sinkMax * 100)}%), and {Math.round(pattern.slowMin * 100)}–
            {Math.round(pattern.slowMax * 100)}% of every scan crosses into denial of service as Slowloris.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex gap-1 rounded-md border border-white/8 p-1" role="group" aria-label="Model">
            {models.map((m) => (
              <button
                key={m}
                onClick={() => setModel(m)}
                aria-pressed={model === m}
                className={`rounded px-2.5 py-1 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                  model === m ? "bg-white/10 text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {MODEL_LABEL[m] ?? m}
              </button>
            ))}
          </div>
          <FigureExport target={svgRef} name={`confusion-${model}`} />
        </div>
      </div>

      <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_17rem]">
        <div>
          <div className="overflow-x-auto">
            <svg
              ref={svgRef}
              viewBox={`0 0 ${size.w} ${size.h}`}
              className="w-full min-w-[520px] max-w-[680px]"
              role="img"
              aria-label={`Confusion matrix for ${MODEL_LABEL[model] ?? model}`}
              onMouseLeave={() => setHover(null)}
              fontFamily={FONT}
            >
              <text x={LEFT} y={14} fontSize={11} fill="#94A3B8">
                predicted →
              </text>
              <text x={8} y={TOP - 8} fontSize={11} fill="#94A3B8">
                true ↓
              </text>

              {/* category bands on both axes */}
              {blocks.map((b) => (
                <g key={b.cat}>
                  <rect x={LEFT + b.start * CELL + 1} y={TOP - 6} width={(b.end - b.start) * CELL - 2} height={3}
                        fill={CATEGORY_COLOR[b.cat]} opacity={0.8} />
                  <rect x={LEFT - 6} y={TOP + b.start * CELL + 1} width={3} height={(b.end - b.start) * CELL - 2}
                        fill={CATEGORY_COLOR[b.cat]} opacity={0.8} />
                </g>
              ))}

              {labels.map((l, i) => (
                <g key={l}>
                  <text x={LEFT - 12} y={TOP + i * CELL + CELL / 2 + 4} fontSize={11} textAnchor="end"
                        fill={hover?.[0] === i ? "#F8FAFC" : "#CBD5E1"}>
                    {prettyClass(l)}
                  </text>
                  <text
                    transform={`translate(${LEFT + i * CELL + CELL / 2 + 4}, ${TOP - 12}) rotate(-60)`}
                    fontSize={11} fill={hover?.[1] === i ? "#F8FAFC" : "#CBD5E1"}
                  >
                    {prettyClass(l)}
                  </text>
                </g>
              ))}

              {rate.map((row, i) =>
                row.map((v, j) => {
                  const diag = i === j;
                  // Stretch errors: 1/3 opacity step per 10%, so small leaks read.
                  const alpha = diag ? 0.08 + 0.92 * v : v === 0 ? 0 : Math.min(1, 0.12 + v * 3);
                  return (
                    <rect
                      key={`${i}-${j}`}
                      x={LEFT + j * CELL + 1}
                      y={TOP + i * CELL + 1}
                      width={CELL - 2}
                      height={CELL - 2}
                      rx={3}
                      fill={diag ? "#22C55E" : "#F43F5E"}
                      fillOpacity={alpha}
                      stroke={hover?.[0] === i && hover?.[1] === j ? "#F8FAFC" : "rgba(255,255,255,0.05)"}
                      strokeWidth={hover?.[0] === i && hover?.[1] === j ? 1.5 : 1}
                      onMouseEnter={() => setHover([i, j])}
                    />
                  );
                }),
              )}
              {rate.map((row, i) =>
                row.map((v, j) =>
                  v >= 0.1 ? (
                    <text key={`t-${i}-${j}`} x={LEFT + j * CELL + CELL / 2} y={TOP + i * CELL + CELL / 2 + 3.5}
                          fontSize={9} textAnchor="middle" fill={i === j && v > 0.5 ? "#022C22" : "#F8FAFC"}
                          pointerEvents="none">
                      {Math.round(v * 100)}
                    </text>
                  ) : null,
                ),
              )}

              {edges.map((e) => (
                <g key={e} stroke="rgba(248,250,252,0.35)" strokeDasharray="3 3">
                  <line x1={LEFT + e * CELL} x2={LEFT + e * CELL} y1={TOP} y2={TOP + n * CELL} />
                  <line x1={LEFT} x2={LEFT + n * CELL} y1={TOP + e * CELL} y2={TOP + e * CELL} />
                </g>
              ))}
            </svg>
          </div>
          <p className="mt-3 min-h-[2.5rem] text-[13px] leading-relaxed text-slate-300" aria-live="polite">
            {readout}
          </p>
          <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" aria-hidden /> named correctly
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm bg-rose-500" aria-hidden /> confused (scale stretched ×3)
            </span>
            {(["dos", "recon", "benign"] as const).map((c) => (
              <span key={c} className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-0.5" style={{ background: CATEGORY_COLOR[c] }} aria-hidden />
                {CATEGORY_LABEL[c]}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
            Largest confusions · {MODEL_LABEL[model] ?? model}
          </h4>
          <ol className="mt-3 space-y-3">
            {worst.map((w) => (
              <li key={`${w.from}-${w.to}`} className="border-b border-white/5 pb-2.5">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="text-[13px] text-slate-200">{prettyClass(w.from)}</span>
                  <span className="font-mono text-sm tabular-nums text-rose-300">
                    {(w.share * 100).toFixed(1)}%
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-500">
                  called {prettyClass(w.to)}
                  {w.crosses && <span className="text-rose-300/85"> · wrong category</span>}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
