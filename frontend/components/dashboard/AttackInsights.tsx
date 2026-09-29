"use client";

import { Fragment, useMemo, useState } from "react";
import { MODEL_COLOR } from "./theme";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Insights = any;

type ModelResult = {
  detected: number; detectedCI: number;
  category: number; categoryCI: number;
  exact: number; exactCI: number;
  verdict: Verdict;
  confusedWith: { label: string; category: string; share: number }[];
};

type Verdict = "identified" | "category" | "detected" | "missed" | "clean" | "false-alarm";

/** One vocabulary, used by the legend, the matrix and the detail panel alike. */
const VERDICT: Record<Verdict, { label: string; plain: string; fg: string; bg: string }> = {
  identified:    { label: "Identified",     plain: "names the exact attack",               fg: "#6EE7B7", bg: "rgba(16,185,129,0.14)" },
  category:      { label: "Right category", plain: "knows the kind of attack, not which one", fg: "#7DD3FC", bg: "rgba(56,189,248,0.14)" },
  detected:      { label: "Flagged only",   plain: "knows something is wrong, not what",     fg: "#FCD34D", bg: "rgba(245,158,11,0.14)" },
  missed:        { label: "Missed",         plain: "let the attack through as normal",       fg: "#FDA4AF", bg: "rgba(244,63,94,0.16)" },
  clean:         { label: "No false alarms", plain: "leaves normal traffic alone",           fg: "#6EE7B7", bg: "rgba(16,185,129,0.14)" },
  "false-alarm": { label: "False alarms",   plain: "flags normal traffic as an attack",      fg: "#FDA4AF", bg: "rgba(244,63,94,0.16)" },
};

const SEVERITY: Record<string, { label: string; fg: string; bg: string }> = {
  critical: { label: "Critical", fg: "#FECDD3", bg: "rgba(225,29,72,0.28)" },
  high:     { label: "High",     fg: "#FED7AA", bg: "rgba(234,88,12,0.24)" },
  medium:   { label: "Medium",   fg: "#FDE68A", bg: "rgba(217,119,6,0.20)" },
  none:     { label: "None",     fg: "#CBD5E1", bg: "rgba(100,116,139,0.20)" },
};

const CATEGORY_LABEL: Record<string, string> = {
  dos: "Denial of service", recon: "Reconnaissance", benign: "Normal traffic",
};

const TONE: Record<string, string> = {
  good: "#34D399", caution: "#38BDF8", warning: "#FB7185", neutral: "#94A3B8",
};

const pct = (v: number) => `${Math.round(v * 100)}%`;

export default function AttackInsights({ insights }: { insights: Insights }) {
  const models: string[] = insights.models;
  const labels: Record<string, string> = insights.modelLabels;
  const attacks: any[] = insights.attacks;
  const [selected, setSelected] = useState<string>(
    attacks.find((a) => a.category === "recon")?.class ?? attacks[0].class,
  );
  const current = useMemo(() => attacks.find((a) => a.class === selected), [attacks, selected]);
  const cfg = insights.config;

  return (
    <div className="space-y-16">
      {/* ── what a visitor should leave knowing ───────────────────── */}
      <section aria-labelledby="takeaways-heading">
        <h2 id="takeaways-heading" className="text-2xl font-semibold tracking-tight text-white text-balance">
          What the attack tests show
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-slate-400">
          Every attack type was fed to every model in {cfg.trials} random batches of {cfg.batch} unseen
          flows, repeated for each of {cfg.modelSeeds.length} independently trained model sets. These
          conclusions are generated from those results, so they update when the tests are re-run.
        </p>
        <ol className="mt-7 space-y-5">
          {insights.takeaways.map((t: any) => (
            <li key={t.headline} className="grid grid-cols-[0.5rem_1fr] gap-4">
              <span aria-hidden className="mt-2 h-2 w-2 rounded-full" style={{ background: TONE[t.tone] }} />
              <div>
                <p className="text-[15px] font-medium text-slate-100">{t.headline}</p>
                <p className="mt-1 max-w-3xl text-sm leading-relaxed text-slate-400">{t.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {/* ── which model wins which attack ─────────────────────────── */}
      <section aria-labelledby="matrix-heading">
        <h2 id="matrix-heading" className="text-2xl font-semibold tracking-tight text-white text-balance">
          Which model is best at which attack
        </h2>
        <p className="mt-2 max-w-3xl text-sm leading-relaxed text-slate-400">
          Each cell is how often that model <span className="text-slate-200">named the attack exactly</span>;
          the smaller figure is how often it at least put it in the <span className="text-slate-200">right
          category</span>. Outlined cells are the best model for that attack — more than one when they tie. Select a row for what it
          means and what to do about it.
        </p>

        <dl className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
          {(["identified", "category", "detected", "missed", "false-alarm"] as Verdict[]).map((v) => (
            <div key={v} className="flex items-center gap-2 text-xs">
              <dt>
                <span className="rounded px-1.5 py-0.5 font-medium" style={{ color: VERDICT[v].fg, background: VERDICT[v].bg }}>
                  {VERDICT[v].label}
                </span>
              </dt>
              <dd className="text-slate-500">{VERDICT[v].plain}</dd>
            </div>
          ))}
        </dl>

        <div className="mt-6 overflow-x-auto rounded-lg border border-white/8">
          <table className="w-full min-w-[46rem] border-collapse text-sm">
            <thead>
              <tr className="border-b border-white/10 bg-white/[0.02] text-left">
                <th scope="col" className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Attack</th>
                {models.map((m) => (
                  <th key={m} scope="col" className="px-3 py-3 text-center text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
                    <span className="inline-flex items-center gap-1.5">
                      <span aria-hidden className="h-1.5 w-1.5 rounded-full" style={{ background: MODEL_COLOR[m] }} />
                      {labels[m]}
                    </span>
                  </th>
                ))}
                <th scope="col" className="px-4 py-3 text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">Best</th>
              </tr>
            </thead>
            <tbody>
              {attacks.map((a, i) => {
                const newGroup = i === 0 || attacks[i - 1].category !== a.category;
                const isSel = a.class === selected;
                return (
                  <Fragment key={a.class}>
                    {newGroup && (
                      <tr className="border-b border-white/8 bg-white/[0.015]">
                        <td colSpan={models.length + 2} className="px-4 pb-2 pt-4 text-[11px] font-medium uppercase tracking-[0.14em] text-slate-400">
                          {CATEGORY_LABEL[a.category]}
                        </td>
                      </tr>
                    )}
                    <tr
                      onClick={() => setSelected(a.class)}
                      className={`cursor-pointer border-b border-white/5 transition-colors ${isSel ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}
                    >
                      <th scope="row" className="px-4 py-2.5 text-left font-normal">
                        <button
                          onClick={() => setSelected(a.class)}
                          aria-pressed={isSel}
                          className="text-left text-[13px] text-slate-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
                        >
                          {a.label}
                          {a.lowSupport && (
                            <span className="ml-1.5 font-mono text-[10px] text-slate-600" title={`Only ${a.support} unseen flows exist; results are resampled and indicative.`}>
                              n={a.support}
                            </span>
                          )}
                        </button>
                      </th>
                      {models.map((m) => {
                        const r: ModelResult = a.models[m];
                        const tied: string[] = a.bestTied ?? [a.bestModel];
                        const isBest = tied.includes(m);
                        return (
                          <td key={m} className="px-2 py-1.5 text-center">
                            <div
                              className="mx-auto w-full max-w-[7.5rem] rounded-md px-2 py-1.5"
                              style={{
                                background: VERDICT[r.verdict].bg,
                                boxShadow: isBest ? `inset 0 0 0 1.5px ${VERDICT[r.verdict].fg}` : undefined,
                              }}
                              title={`${labels[m]}: ${VERDICT[r.verdict].plain}`}
                            >
                              <span className="block font-mono text-[13px] tabular-nums" style={{ color: VERDICT[r.verdict].fg }}>
                                {pct(r.exact)}
                              </span>
                              {a.class !== "Benign" && (
                                <span className="block font-mono text-[10px] tabular-nums text-slate-500">
                                  category {pct(r.category)}
                                </span>
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="px-4 py-2.5 text-[12px] text-slate-300">
                        {(a.bestTied ?? [a.bestModel]).length === models.length
                          ? "All four tie"
                          : (a.bestTied ?? [a.bestModel]).map((m: string) => labels[m]).join(" = ")}
                      </td>
                    </tr>
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          For normal traffic the cell shows how often it was correctly left alone — the failure there is a
          false alarm, not a miss. Rows marked n= have under 100 unseen flows in the whole dataset.
        </p>
      </section>

      {/* ── the selected attack, and what to do ──────────────────── */}
      {current && <AttackDetail attack={current} models={models} labels={labels} roles={insights.roles} />}

      {/* ── provenance ─────────────────────────────────────────────── */}
      <section aria-labelledby="provenance-heading" className="border-t border-white/8 pt-8">
        <h3 id="provenance-heading" className="text-lg font-semibold tracking-tight text-white">How these tests were run</h3>
        <dl className="mt-4 grid gap-x-8 gap-y-2 sm:grid-cols-2 lg:grid-cols-3">
          {[
            ["Batches per attack", `${cfg.trials} per model set`],
            ["Flows per batch", String(cfg.batch)],
            ["Model sets", cfg.modelSeeds.join(" / ")],
            ["Mixed campaigns", `${insights.campaign.trials} × 4 attacks`],
            ["Regression gates", insights.passed ? "all passed" : `${insights.gateFailures.length} failed`],
            ["Tested", new Date(insights.testedAt).toISOString().slice(0, 16).replace("T", " ") + " UTC"],
          ].map(([k, v]) => (
            <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1.5">
              <dt className="text-xs text-slate-500">{k}</dt>
              <dd className={`font-mono text-xs tabular-nums ${k === "Regression gates" ? (insights.passed ? "text-emerald-300" : "text-rose-300") : "text-slate-300"}`}>{v}</dd>
            </div>
          ))}
        </dl>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Re-run with <code className="font-mono text-slate-300">make attack-test</code>. Each run draws fresh
          flows unless a seed is fixed, and exits with an error if any regression gate fails.
        </p>
      </section>
    </div>
  );
}

function AttackDetail({
  attack, models, labels, roles,
}: {
  attack: any; models: string[]; labels: Record<string, string>; roles: Record<string, string>;
}) {
  const best: ModelResult = attack.models[attack.bestModel];
  const sev = SEVERITY[attack.response.severity] ?? SEVERITY.medium;
  const isBenign = attack.class === "Benign";
  const roleKeys = Object.keys(roles).filter((r) => (attack.response.actions[r] ?? []).length > 0);

  return (
    <section aria-labelledby="detail-heading" className="rounded-lg border border-white/8 bg-white/[0.02] p-6">
      <div className="flex flex-wrap items-center gap-2.5">
        <h2 id="detail-heading" className="text-xl font-semibold tracking-tight text-white">{attack.label}</h2>
        <span className="rounded px-1.5 py-0.5 text-[11px] font-medium" style={{ color: sev.fg, background: sev.bg }}>
          {sev.label} severity
        </span>
        <span className="rounded border border-white/10 px-1.5 py-0.5 text-[11px] text-slate-400">
          {CATEGORY_LABEL[attack.category]}
        </span>
      </div>
      <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-300">{attack.response.what}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">How well it is caught</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">
            {isBenign ? (
              <>
                The best model, <span className="text-slate-100">{labels[attack.bestModel]}</span>, leaves{" "}
                <span className="font-mono tabular-nums">{pct(best.exact)}</span> of normal flows alone.
              </>
            ) : (
              <>
                {(attack.bestTied ?? []).length === models.length ? "Every model" : <>The best model, <span className="text-slate-100">{labels[attack.bestModel]}</span>,</>}{" "}flags it as
                malicious <span className="font-mono tabular-nums">{pct(best.detected)}</span> of the time,
                recognises it as {CATEGORY_LABEL[attack.category].toLowerCase()}{" "}
                <span className="font-mono tabular-nums">{pct(best.category)}</span>, and names it exactly{" "}
                <span className="font-mono tabular-nums">{pct(best.exact)}</span>
                <span className="text-slate-500"> (± {pct(best.exactCI)})</span>.
              </>
            )}
          </p>

          <div className="mt-4 space-y-2.5">
            {models.map((m) => {
              const r: ModelResult = attack.models[m];
              return (
                <div key={m}>
                  <div className="flex items-baseline justify-between gap-3 text-xs">
                    <span className="text-slate-400">{labels[m]}</span>
                    <span className="rounded px-1.5 py-0.5 text-[10px] font-medium" style={{ color: VERDICT[r.verdict].fg, background: VERDICT[r.verdict].bg }}>
                      {VERDICT[r.verdict].label}
                    </span>
                  </div>
                  <div className="relative mt-1 h-1.5 overflow-hidden rounded-full bg-white/[0.05]">
                    {!isBenign && (
                      <div className="absolute inset-y-0 left-0 rounded-full bg-sky-400/35" style={{ width: pct(r.category) }} />
                    )}
                    <div className="absolute inset-y-0 left-0 rounded-full" style={{ width: pct(r.exact), background: VERDICT[r.verdict].fg }} />
                  </div>
                </div>
              );
            })}
            {!isBenign && (
              <p className="pt-1 text-[11px] text-slate-500">Solid bar: named exactly. Pale bar: right category.</p>
            )}
          </div>

          {!isBenign && best.confusedWith.length > 0 && (
            <>
              <h3 className="mt-6 text-[11px] uppercase tracking-[0.14em] text-slate-500">When it is wrong, it is called</h3>
              <ul className="mt-2 space-y-1.5">
                {best.confusedWith.map((c) => (
                  <li key={c.label} className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="text-slate-300">
                      {c.label.replace(/_/g, " ")}
                      <span className="ml-1.5 text-xs text-slate-500">
                        {c.category === attack.category ? "same category" : CATEGORY_LABEL[c.category].toLowerCase()}
                      </span>
                    </span>
                    <span className="font-mono text-xs tabular-nums text-slate-400">{pct(c.share)} of flows</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>

        <div>
          <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Why it matters</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-300">{attack.response.impact}</p>
          {attack.response.uncertainty && (
            <p className="mt-4 rounded-md border border-sky-400/25 bg-sky-400/[0.07] px-3.5 py-2.5 text-sm leading-relaxed text-sky-100">
              {attack.response.uncertainty}
            </p>
          )}
        </div>
      </div>

      {roleKeys.length > 0 && (
        <>
          <h3 className="mt-8 text-[11px] uppercase tracking-[0.14em] text-slate-500">What to do</h3>
          <div className="mt-3 grid gap-5 md:grid-cols-3">
            {roleKeys.map((role) => (
              <div key={role} className="border-t border-white/10 pt-3">
                <p className="text-sm font-medium text-slate-100">{roles[role]}</p>
                <ul className="mt-2.5 space-y-2.5">
                  {attack.response.actions[role].map((step: string) => (
                    <li key={step} className="grid grid-cols-[0.75rem_1fr] gap-1.5 text-[13px] leading-relaxed text-slate-400 [overflow-wrap:anywhere]">
                      <span aria-hidden className="mt-[0.55rem] h-1 w-1 rounded-full bg-slate-500" />
                      <span>{step}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <p className="mt-5 text-xs leading-relaxed text-slate-500">
            Standard defensive measures for this attack mechanism, adapted to an OCPP charging network. They
            are operator guidance and were not themselves tested in this project.
          </p>
        </>
      )}
    </section>
  );
}
