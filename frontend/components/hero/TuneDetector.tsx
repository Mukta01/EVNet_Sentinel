"use client";

import { useMemo, useState } from "react";

type Cat = { n: number; rightHist: number[]; wrongHist: number[] };
export type HeroTuning = {
  bins: number;
  seeds: number[];
  models: Record<string, {
    falseAlarm: number;
    benignN: number;
    stream: { label: string; called: string; p: number }[];
    categories: Record<"dos" | "recon", Cat>;
  }>;
};

const LABEL: Record<string, string> = { RandomForest: "Random Forest", DecisionTree: "Decision Tree" };
const ROWS = [
  { key: "dos", title: "Denial of service" },
  { key: "recon", title: "Scans (reconnaissance)" },
] as const;
const SEG = {
  right: { color: "#22C55E", label: "named right" },
  wrong: { color: "#F43F5E", label: "named wrong" },
  hedge: { color: "#F59E0B", label: "category only" },
};
const SCANS = new Set(["TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection", "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"]);
const pretty = (s: string) => s.replace(/_/g, " ");

/** Shares at bar t (0–1): named right, named wrong, category only. */
function shares(c: Cat, t: number, bins: number) {
  const from = Math.min(bins, Math.floor(t * bins));
  const sum = (h: number[]) => h.slice(from).reduce((a, b) => a + b, 0);
  const right = sum(c.rightHist) / c.n;
  const wrong = sum(c.wrongHist) / c.n;
  return { right, wrong, hedge: Math.max(0, 1 - right - wrong) };
}

/**
 * How sure must the detector be before it names an attack? Below the bar it
 * reports only the category. Drag it and watch wrong names turn into honest
 * "it's a scan" answers — and see that a single tree can't tell when it's unsure.
 */
export default function TuneDetector({ data }: { data: HeroTuning }) {
  const models = Object.keys(data.models);
  const [model, setModel] = useState(models[0]);
  const [bar, setBar] = useState(0);
  const m = data.models[model];
  const t = bar / 100;

  const rows = useMemo(
    () => ROWS.map((r) => ({ ...r, s: shares(m.categories[r.key], t, data.bins) })),
    [m, t, data.bins],
  );
  const base = shares(m.categories.recon, 0, data.bins);
  const scans = rows[1].s;

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-lg font-semibold text-white">How sure should Sentinel be before it names an attack?</p>
          <p className="mt-0.5 text-[13px] text-slate-400">Below the bar it only says “denial of service” or “scan”. Drag it.</p>
        </div>
        <div className="flex gap-1 rounded-lg border border-white/10 p-1" role="group" aria-label="Model">
          {models.map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setModel(k)}
              aria-pressed={model === k}
              className={`rounded-md px-3 py-1.5 text-[12.5px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                model === k ? "bg-white/10 text-white" : "text-slate-400 hover:text-slate-200"
              }`}
            >
              {LABEL[k] ?? k}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <div className="flex items-baseline justify-between">
          <label htmlFor="name-bar" className="text-[13px] text-slate-300">
            Name it only when at least <b className="font-mono text-white">{bar}%</b> sure
          </label>
          <span className="font-mono text-[11px] text-slate-500">{bar === 0 ? "always names (default)" : ""}</span>
        </div>
        <input
          id="name-bar"
          type="range"
          min={0}
          max={99}
          value={bar}
          onChange={(e) => setBar(Number(e.target.value))}
          className="mt-2 w-full accent-emerald-400"
        />
      </div>

      <div className="mt-5 space-y-4">
        {rows.map((r) => (
          <div key={r.key}>
            <div className="flex items-baseline justify-between text-[12.5px]">
              <span className="text-slate-200">{r.title}</span>
              <span className="font-mono text-slate-400">
                <span style={{ color: SEG.right.color }}>{Math.round(r.s.right * 100)}%</span> ·{" "}
                <span style={{ color: SEG.wrong.color }}>{Math.round(r.s.wrong * 100)}%</span> ·{" "}
                <span style={{ color: SEG.hedge.color }}>{Math.round(r.s.hedge * 100)}%</span>
              </span>
            </div>
            <div className="mt-1.5 flex h-3.5 overflow-hidden rounded-full bg-white/[0.04]">
              {(["right", "wrong", "hedge"] as const).map((k) => (
                <div key={k} className="h-full transition-[width] duration-200"
                     style={{ width: `${r.s[k] * 100}%`, background: SEG[k].color, opacity: k === "hedge" ? 0.75 : 0.9 }} />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* live stream of real flows, recoloured by the bar */}
      <div className="mt-5 flex flex-wrap gap-1.5" aria-label="Sample of real flows at this setting">
        {m.stream.map((f, i) => {
          const named = f.p >= t;
          const state = !named ? "hedge" : f.called === f.label ? "right" : "wrong";
          return (
            <span
              key={i}
              title={`${pretty(f.label)} → ${named ? `called ${pretty(f.called)}` : `“${SCANS.has(f.label) ? "a scan" : "denial of service"}”`} (${Math.round(f.p * 100)}% sure)`}
              className="h-3 w-3 rounded-[3px] transition-colors duration-200"
              style={{ background: SEG[state].color, opacity: SCANS.has(f.label) ? 1 : 0.55 }}
            />
          );
        })}
      </div>

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[11.5px] text-slate-400">
        {Object.values(SEG).map((s) => (
          <span key={s.label} className="inline-flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
          </span>
        ))}
        <span className="text-slate-500">· bright squares are scans</span>
      </div>

      <p className="mt-4 text-[13px] leading-relaxed text-slate-400" aria-live="polite">
        {bar === 0
          ? `Always naming, ${LABEL[model]} gets ${Math.round(base.wrong * 100)}% of scans wrong. Raise the bar.`
          : `Wrong scan names: ${Math.round(base.wrong * 100)}% → ${Math.round(scans.wrong * 100)}%. ` +
            (scans.wrong > 0.01 && bar > 80
              ? `${LABEL[model]} stays confidently wrong on some scans — a single tree can’t tell when it’s unsure.`
              : `The rest are honestly reported as “a scan”.`)}
        {" "}False alarms on normal traffic: {(m.falseAlarm * 100).toFixed(1)}% ({m.benignN} flows).
      </p>
    </div>
  );
}
