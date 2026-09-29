"use client";

import { useRef, useState } from "react";
import FigureExport from "./FigureExport";
import { prettyClass } from "./theme";

type Segment = { start: number; end: number; file: string; label: string; category: string };
type Event = { instance: number; accuracy: number; distance?: number };
export type DriftData = {
  instances: number;
  segments: Segment[];
  capture: { accuracy: number; events: Event[] };
  shuffled: { accuracy: number; events: Event[] };
};

const W = 920;
const H = 300;
const L = 48;
const R = 16;
const BAND_Y = 26;
const BAND_H = 16;
const PLOT_TOP = 70;
const PLOT_BOTTOM = 250;
const Y_MIN = 0.3;
const FONT = "Inter, ui-sans-serif, system-ui, sans-serif";

const SEGMENT_COLOR: Record<string, string> = {
  volumetric: "#22C55E",
  recon: "#F59E0B",
  other: "#64748B",
  benign: "#38BDF8",
};
const ORDER_COLOR = { capture: "#34D399", shuffled: "#A78BFA" };

/**
 * The stream the online model saw, with the capture files it was stitched from
 * along the top. In capture order every ADWIN alarm sits on a file seam; the
 * same model on the shuffled stream alarms rarely and scores 44 points lower.
 */
export default function DriftTimeline({
  drift,
  groups,
  withinHundred,
}: {
  drift: DriftData;
  groups: Record<string, string>;
  withinHundred: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [hover, setHover] = useState<{ order: "capture" | "shuffled"; event: Event } | null>(null);
  const [hoverSeg, setHoverSeg] = useState<Segment | null>(null);

  const x = (i: number) => L + (i / drift.instances) * (W - L - R);
  const y = (a: number) => PLOT_BOTTOM - ((a - Y_MIN) / (1 - Y_MIN)) * (PLOT_BOTTOM - PLOT_TOP);
  const family = (label: string) => (label === "Benign" ? "benign" : groups[label] ?? "other");
  const segmentAt = (i: number) => drift.segments.find((s) => i >= s.start && i < s.end);

  const line = (events: Event[], final: number) =>
    [...events.map((e) => `${x(e.instance)},${y(e.accuracy)}`), `${x(drift.instances)},${y(final)}`]
      .map((p, i) => `${i ? "L" : "M"}${p}`)
      .join(" ");

  const readout = hover
    ? (() => {
        const seg = segmentAt(hover.event.instance);
        return hover.order === "capture"
          ? `Capture order · alarm at flow ${hover.event.instance.toLocaleString()}, ${hover.event.distance} flows from a file seam${
              seg ? ` (entering ${prettyClass(seg.label)} capture)` : ""
            } · running accuracy ${(hover.event.accuracy * 100).toFixed(1)}%`
          : `Shuffled · alarm at flow ${hover.event.instance.toLocaleString()} · running accuracy ${(hover.event.accuracy * 100).toFixed(1)}%`;
      })()
    : hoverSeg
      ? `${hoverSeg.file} · ${prettyClass(hoverSeg.label)} · ${(hoverSeg.end - hoverSeg.start).toLocaleString()} flows`
      : "Hover an alarm or a capture file.";

  return (
    <section aria-labelledby="drift-timeline-heading">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h3 id="drift-timeline-heading" className="text-lg font-semibold tracking-tight text-white">
            Drift alarms land on file seams
          </h3>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
            {`The ${drift.instances.toLocaleString()}-flow training stream, built from ${drift.segments.length} capture files laid end to end (top band).`}{" "}
            Dots are ADWIN drift
            alarms at the model&rsquo;s running accuracy. In capture order {withinHundred} of{" "}
            {drift.capture.events.length} alarms fall within 100 flows of a seam.
          </p>
        </div>
        <FigureExport target={svgRef} name="drift-timeline" />
      </div>

      <div className="mt-6 overflow-x-auto">
        <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`} className="w-full min-w-[640px]" role="img"
             aria-label="ADWIN drift alarms against capture-file boundaries" fontFamily={FONT}
             onMouseLeave={() => { setHover(null); setHoverSeg(null); }}>
          <text x={L} y={16} fontSize={10.5} fill="#64748B">capture files, in stream order</text>

          {drift.segments.map((s) => (
            <rect key={s.start} x={x(s.start)} y={BAND_Y} width={Math.max(0.8, x(s.end) - x(s.start) - 0.6)}
                  height={BAND_H} fill={SEGMENT_COLOR[family(s.label)]}
                  fillOpacity={hoverSeg === s ? 1 : 0.7}
                  onMouseEnter={() => { setHoverSeg(s); setHover(null); }} />
          ))}

          {/* seams */}
          {drift.segments.slice(1).map((s) => (
            <line key={`seam-${s.start}`} x1={x(s.start)} x2={x(s.start)} y1={BAND_Y + BAND_H} y2={PLOT_BOTTOM}
                  stroke="rgba(148,163,184,0.16)" strokeDasharray="2 3" />
          ))}

          {/* axes */}
          {[0.3, 0.5, 0.75, 1].map((t) => (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y(t)} y2={y(t)} stroke="rgba(255,255,255,0.05)" />
              <text x={L - 8} y={y(t) + 3.5} fontSize={10} fill="#64748B" textAnchor="end">
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          <text x={12} y={(PLOT_TOP + PLOT_BOTTOM) / 2} fontSize={10} fill="#64748B"
                transform={`rotate(-90 12 ${(PLOT_TOP + PLOT_BOTTOM) / 2})`} textAnchor="middle">
            running accuracy
          </text>
          {[0, 0.5, 1, 1.5].map((m) => m * 1e6 <= drift.instances && (
            <text key={m} x={x(m * 1e6)} y={PLOT_BOTTOM + 18} fontSize={10} fill="#64748B" textAnchor="middle">
              {m === 0 ? "0" : `${m}M`}
            </text>
          ))}
          <text x={W - R} y={PLOT_BOTTOM + 18} fontSize={10} fill="#64748B" textAnchor="end">flows →</text>

          {(["shuffled", "capture"] as const).map((order) => {
            const run = drift[order];
            return (
              <g key={order}>
                <path d={line(run.events, run.accuracy)} fill="none" stroke={ORDER_COLOR[order]}
                      strokeOpacity={0.55} strokeWidth={1.5} />
                {run.events.map((e) => (
                  <g key={`${order}-${e.instance}`}>
                    {order === "capture" && (
                      <path d={`M${x(e.instance)},${BAND_Y + BAND_H + 3} l-3.5,6 h7 z`} fill={ORDER_COLOR.capture} />
                    )}
                    <circle cx={x(e.instance)} cy={y(e.accuracy)}
                            r={hover?.event === e ? 5 : 3.2} fill={ORDER_COLOR[order]}
                            stroke="#020617" strokeWidth={1} />
                    <circle cx={x(e.instance)} cy={y(e.accuracy)} r={9} fill="transparent"
                            onMouseEnter={() => { setHover({ order, event: e }); setHoverSeg(null); }} />
                  </g>
                ))}
                <text x={W - R} y={y(run.accuracy) - 8} fontSize={11} textAnchor="end" fill={ORDER_COLOR[order]}>
                  {order === "capture" ? "Capture order" : "Shuffled"} · {(run.accuracy * 100).toFixed(run.accuracy > 0.995 ? 2 : 1)}% ·{" "}
                  {run.events.length} alarms
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      <p className="mt-3 min-h-[1.5rem] text-[13px] text-slate-300" aria-live="polite">{readout}</p>
      <div className="mt-2 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-slate-500">
        {[["volumetric", "Volumetric flood"], ["recon", "Reconnaissance"], ["other", "Low-rate or sparse"], ["benign", "Benign"]].map(
          ([k, label]) => (
            <span key={k} className="inline-flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-sm" style={{ background: SEGMENT_COLOR[k] }} aria-hidden />
              {label}
            </span>
          ),
        )}
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[9px]" style={{ color: ORDER_COLOR.capture }} aria-hidden>▲</span>
          alarm position (capture order)
        </span>
      </div>
    </section>
  );
}
