"use client";

import { useEffect, useState } from "react";
import { MODEL_LABEL, fmtPct, fmtScoreStd } from "./theme";

/* eslint-disable @typescript-eslint/no-explicit-any */

export const FINDINGS_SECTIONS = [
  { id: "f-leak", label: "The leak" },
  { id: "f-classes", label: "Floods vs scans" },
  { id: "f-confusion", label: "Confusion" },
  { id: "f-models", label: "Models" },
  { id: "f-features", label: "Features" },
  { id: "f-response", label: "Response" },
  { id: "f-audit", label: "Audit evidence" },
] as const;

/**
 * The Findings tab in four numbers, each a link to the section that backs it.
 * Every figure is read from the same exports the sections use.
 */
export function FindingsOverview({ findings, insights, replay }: { findings: any; insights: any; replay: any }) {
  const primary: string = insights.primary;
  const model = findings.models.find((m: any) => m.name === primary) ?? findings.models[0];
  const mean = (group: string) => {
    const rows = findings.perClass.filter((r: any) => r.group === group);
    const f1 = rows.reduce((s: number, r: any) => s + r.models[primary].f1, 0) / rows.length;
    const std = Math.max(...rows.map((r: any) => r.models[primary].std));
    return { f1, std };
  };
  const floods = mean("volumetric");
  const scans = mean("recon");
  const esc = replay.summary.escalation;

  const cards = [
    { href: "#f-leak", kicker: "The leak", value: fmtPct(findings.singleColumnProbe[0].accuracy),
      note: `One timestamp column alone scores this. The published ${fmtPct(findings.paperReported.accuracy)} rests on it.`,
      cls: "text-rose-300" },
    { href: "#f-models", kicker: `Corrected · ${MODEL_LABEL[primary] ?? primary}`, value: fmtScoreStd(model.macro_f1, model.macro_f1_std, 4),
      note: `Macro-F1 with the leak removed, ${findings.seeds.length} seeds. The primary detector.`,
      cls: "text-emerald-300" },
    { href: "#f-classes", kicker: "Floods vs scans", value: `${fmtScoreStd(floods.f1, floods.std)}`,
      note: `Mean F1 on the five floods (± the largest seed spread among them); the six scans average ${fmtScoreStd(scans.f1, scans.std)}.`,
      cls: "text-sky-300" },
    { href: "#f-response", kicker: "After detection", value: `${replay.summary.contained}/${replay.summary.scenarios}`,
      note: `Attacks contained in the replay; a scanner that floods is quarantined after ${esc.afterScanFlowsToQuarantine} flow, not ${esc.coldFloodFlowsToQuarantine}.`,
      cls: "text-amber-300" },
  ];

  return (
    <section aria-label="Findings at a glance" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <a key={c.href} href={c.href}
          className="group rounded-lg border border-white/8 bg-white/[0.02] p-4 transition-colors hover:border-white/15 hover:bg-white/[0.04] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
          <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">{c.kicker}</p>
          <p className={`mt-2 font-mono text-[22px] tabular-nums leading-tight ${c.cls}`}>{c.value}</p>
          <p className="mt-2 text-[12.5px] leading-snug text-slate-400">{c.note}</p>
          <p className="mt-3 text-[11px] text-slate-500 transition-colors group-hover:text-slate-300">See the evidence →</p>
        </a>
      ))}
    </section>
  );
}

/** A sticky row of section links under the tabs; the section in view is highlighted. */
export function SectionNav() {
  const [active, setActive] = useState<string>(FINDINGS_SECTIONS[0].id);

  useEffect(() => {
    const els = FINDINGS_SECTIONS.map((s) => document.getElementById(s.id)).filter(Boolean) as HTMLElement[];
    if (!els.length) return;
    const io = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActive(visible[0].target.id);
      },
      // A section counts as current once its top passes the sticky bars.
      { rootMargin: "-140px 0px -55% 0px" },
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, []);

  return (
    <nav aria-label="Findings sections" className="-mx-6 overflow-x-auto px-6">
      <ul className="flex gap-1 py-2">
        {FINDINGS_SECTIONS.map((s, i) => (
          <li key={s.id}>
            <a href={`#${s.id}`} aria-current={active === s.id ? "true" : undefined}
              className={`block whitespace-nowrap rounded-md px-2.5 py-1 text-[12px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                active === s.id ? "bg-emerald-500/15 text-emerald-200" : "text-slate-500 hover:text-slate-300"
              }`}>
              <span className="mr-1 font-mono text-[10px] opacity-60">{String(i + 1).padStart(2, "0")}</span>{s.label}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  );
}
