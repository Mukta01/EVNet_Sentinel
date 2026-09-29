"use client";

import { MODEL_LABEL, prettyClass } from "../dashboard/theme";

export type Incident = {
  model: string;
  label: string;
  category: "dos" | "recon" | "benign";
  firstSeen: string;
  seen: number;
  flagged: number;
  exact: number;
  sameCategory: number;
  calls: Record<string, number>;
};

/** Same ladder and threshold as the attack test harness (src/evaluation/attack_test_harness.py). */
const RELIABLE = 0.9;
const OUTCOME = {
  identified: { label: "Named", color: "#86EFAC", bg: "rgba(34,197,94,0.14)" },
  category: { label: "Category only", color: "#7DD3FC", bg: "rgba(56,189,248,0.14)" },
  detected: { label: "Flagged, misnamed", color: "#FCD34D", bg: "rgba(245,158,11,0.14)" },
  missed: { label: "Missed", color: "#FDA4AF", bg: "rgba(244,63,94,0.16)" },
  clean: { label: "No false alarms", color: "#86EFAC", bg: "rgba(34,197,94,0.14)" },
  few: { label: "Few false alarms", color: "#FCD34D", bg: "rgba(245,158,11,0.14)" },
  noisy: { label: "Too many false alarms", color: "#FDA4AF", bg: "rgba(244,63,94,0.16)" },
} as const;

function outcome(r: Incident): keyof typeof OUTCOME {
  if (r.category === "benign")
    return r.flagged === 0 ? "clean" : r.flagged / r.seen <= 1 - RELIABLE ? "few" : "noisy";
  if (r.exact / r.seen >= RELIABLE) return "identified";
  if (r.sameCategory / r.seen >= RELIABLE) return "category";
  if (r.flagged / r.seen >= RELIABLE) return "detected";
  return "missed";
}

const pct = (a: number, b: number) => (b ? `${Math.round((100 * a) / b)}%` : "—");

/**
 * A running record of every attack the detector has judged in this session,
 * the way a SOC would log them: when, what, and whether it was caught and
 * named. Survives switching attacks; switching model starts new rows.
 */
export default function IncidentLog({ incidents, onClear }: { incidents: Incident[]; onClear: () => void }) {
  const attacks = incidents.filter((r) => r.category !== "benign");
  const normal = incidents.filter((r) => r.category === "benign");
  const outcomes = attacks.map(outcome);
  const count = (o: keyof typeof OUTCOME) => outcomes.filter((x) => x === o).length;
  const normalSeen = normal.reduce((a, r) => a + r.seen, 0);
  const normalFlagged = normal.reduce((a, r) => a + r.flagged, 0);

  return (
    <section className="rounded-lg border border-white/8 bg-white/[0.02] p-4" aria-labelledby="incident-log-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h3 id="incident-log-heading" className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Incident log
        </h3>
        {incidents.length > 0 && (
          <button onClick={onClear}
            className="text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
            clear
          </button>
        )}
      </div>

      {incidents.length === 0 ? (
        <p className="mt-2 text-[12px] leading-relaxed text-slate-500">
          Launch an attack or run a campaign. Each attack the detector judges gets a row here with how
          many of its flows were flagged, put in the right category and named exactly.
        </p>
      ) : (
        <>
          <dl className="mt-3 flex flex-wrap gap-x-8 gap-y-2">
            {[
              ["Attacks logged", String(attacks.length)],
              ["Named", String(count("identified"))],
              ["Category only", String(count("category"))],
              ["Flagged, misnamed", String(count("detected"))],
              ["Missed", String(count("missed"))],
              ["False alarms", normalSeen ? `${normalFlagged} of ${normalSeen} normal` : "—"],
            ].map(([k, v]) => (
              <div key={k}>
                <dt className="text-[10.5px] text-slate-500">{k}</dt>
                <dd className="font-mono text-lg tabular-nums text-slate-100">{v}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[720px] text-left text-[12px]">
              <thead>
                <tr className="border-b border-white/8 text-[10.5px] uppercase tracking-[0.1em] text-slate-500">
                  <th className="py-2 pr-3 font-medium">First seen</th>
                  <th className="py-2 pr-3 font-medium">Traffic</th>
                  <th className="py-2 pr-3 font-medium">Detector</th>
                  <th className="py-2 pr-3 text-right font-medium">Flows</th>
                  <th className="py-2 pr-3 text-right font-medium">Flagged</th>
                  <th className="py-2 pr-3 text-right font-medium">Right category</th>
                  <th className="py-2 pr-3 text-right font-medium">Named</th>
                  <th className="py-2 pr-3 font-medium">Most often called</th>
                  <th className="py-2 font-medium">Outcome</th>
                </tr>
              </thead>
              <tbody>
                {incidents.map((r) => {
                  const o = OUTCOME[outcome(r)];
                  const [topCall, topCount] = Object.entries(r.calls).sort((a, b) => b[1] - a[1])[0];
                  const benign = r.category === "benign";
                  return (
                    <tr key={`${r.model}-${r.label}`} className="border-b border-white/5">
                      <td className="py-2 pr-3 font-mono tabular-nums text-slate-500">{r.firstSeen}</td>
                      <td className="py-2 pr-3 text-slate-200">{benign ? "Normal traffic" : prettyClass(r.label)}</td>
                      <td className="py-2 pr-3 text-slate-400">{MODEL_LABEL[r.model] ?? r.model.replace(/_/g, " ")}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-300">{r.seen}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-300">
                        {benign ? <span className={r.flagged ? "text-rose-300" : ""}>{r.flagged} false</span> : pct(r.flagged, r.seen)}
                      </td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-300">{benign ? "—" : pct(r.sameCategory, r.seen)}</td>
                      <td className="py-2 pr-3 text-right font-mono tabular-nums text-slate-300">{benign ? "—" : pct(r.exact, r.seen)}</td>
                      <td className="py-2 pr-3 text-slate-400">
                        {topCall === r.label ? <span className="text-slate-500">itself</span> : prettyClass(topCall)}
                        <span className="font-mono text-slate-600"> ×{topCount}</span>
                      </td>
                      <td className="py-2">
                        <span className="rounded px-1.5 py-0.5 text-[10.5px] font-medium" style={{ color: o.color, background: o.bg }}>
                          {o.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-3 text-[11px] leading-relaxed text-slate-500">
            Outcome uses the attack test harness&rsquo;s rule: a level counts when at least{" "}
            {Math.round(RELIABLE * 100)}% of the attack&rsquo;s flows reach it. A handful of flows is a demo, not a
            measurement — the Attack insights tab on the dashboard has the tested rates.
          </p>
        </>
      )}
    </section>
  );
}
