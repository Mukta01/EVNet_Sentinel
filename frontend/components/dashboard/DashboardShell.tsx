"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import ClassSeparation from "./ClassSeparation";
import DriftAlignment from "./DriftAlignment";
import FingerprintAblation from "./FingerprintAblation";
import InferenceReplay, { type Flow } from "./InferenceReplay";
import LeakEvidence from "./LeakEvidence";
import ModelTable from "./ModelTable";
import type { Family } from "./theme";

/* eslint-disable @typescript-eslint/no-explicit-any */
type Findings = any;
type Simulation = any;

const TABS = [
  { id: "findings", label: "Findings" },
  { id: "replay", label: "Live inference" },
] as const;

type TabId = (typeof TABS)[number]["id"];

const numberFormat = new Intl.NumberFormat("en-US");

export default function DashboardShell({
  findings,
  simulation,
}: {
  findings: Findings;
  simulation: Simulation;
}) {
  const [tab, setTab] = useState<TabId>("findings");

  const dataset = findings.dataset;
  const environment = findings.environment;

  const provenance: { term: string; value: string }[] = [
    { term: "Dataset", value: "CICEVSE2024 · network traffic" },
    { term: "Flows", value: numberFormat.format(dataset.rows_after_dedup) },
    { term: "Features", value: String(dataset.n_features) },
    { term: "Classes", value: String(dataset.n_classes) },
    { term: "Seeds", value: findings.seeds.join(" / ") },
    { term: "Feature set", value: findings.featureSet },
  ];

  return (
    <div className="mx-auto max-w-6xl px-6 pb-24 pt-28">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-white sm:text-4xl text-balance">
          Intrusion detection results, with the leakage removed
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          A reproduction of Makhmudov et al. (2025) on the CICEVSE2024 charging-station
          dataset. The published pipeline retains six absolute capture timestamps that
          identify the recording rather than the traffic; everything here is measured
          with those columns removed.
        </p>

        <dl className="mt-8 grid grid-cols-2 gap-x-8 gap-y-4 border-t border-white/8 pt-6 sm:grid-cols-3 lg:grid-cols-6">
          {provenance.map((item) => (
            <div key={item.term}>
              <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
                {item.term}
              </dt>
              <dd className="mt-1 font-mono text-sm tabular-nums text-slate-200">
                {item.value}
              </dd>
            </div>
          ))}
        </dl>
      </header>

      <nav
        aria-label="Dashboard sections"
        className="sticky top-16 z-30 -mx-6 mt-10 border-b border-white/8 bg-[#020617]/85 px-6 backdrop-blur-xl"
      >
        <div className="flex gap-1">
          {TABS.map((item) => {
            const selected = tab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setTab(item.id)}
                aria-current={selected ? "page" : undefined}
                className={`relative px-4 py-3 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-emerald-400 ${
                  selected ? "text-white" : "text-slate-500 hover:text-slate-300"
                }`}
              >
                {item.label}
                {selected && (
                  <motion.span
                    layoutId="dashboard-tab-underline"
                    className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-emerald-400"
                    transition={{ type: "spring", stiffness: 420, damping: 34 }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </nav>

      {tab === "findings" ? (
        <div className="space-y-20 pt-12">
          <ClassSeparation
            rows={findings.perClass as { class: string; group: Family; support: number; models: Record<string, { f1: number; std: number }> }[]}
            models={findings.models.map((m: { name: string }) => m.name)}
            control={findings.supportControl}
          />
          <ModelTable models={findings.models} seeds={findings.seeds} />
          <LeakEvidence
            probes={findings.singleColumnProbe}
            effects={findings.leakEffect}
            paperAccuracy={findings.paperReported.accuracy}
          />
          <FingerprintAblation rows={findings.fingerprintAblation} />
          <DriftAlignment
            drift={findings.drift}
            streamOrder={findings.streamOrder}
            paperEvents={findings.paperReported.driftEvents}
          />
          <Environment environment={environment} generated={findings.generated} />
        </div>
      ) : (
        <div className="pt-12">
          <InferenceReplay
            flows={simulation.flows as Flow[]}
            models={simulation.models}
            provenance={simulation.provenance}
          />
        </div>
      )}
    </div>
  );
}

function Environment({
  environment,
  generated,
}: {
  environment: {
    cpu: string;
    logical_cores: number;
    ram_gb: number | string;
    os: string;
    machine: string;
    versions: Record<string, string>;
  };
  generated: string;
}) {
  const rows: [string, string][] = [
    ["CPU", environment.cpu],
    ["Logical cores", String(environment.logical_cores)],
    ["Memory", `${environment.ram_gb} GB`],
    ["OS", `${environment.os} (${environment.machine})`],
    ...Object.entries(environment.versions).map(
      ([library, version]) => [library, version] as [string, string],
    ),
  ];

  return (
    <section aria-labelledby="env-heading" className="border-t border-white/8 pt-10">
      <h3 id="env-heading" className="text-lg font-semibold tracking-tight text-white">
        Run environment
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
        Recorded automatically alongside the metrics, so the timings above can be
        read against the hardware that produced them.
      </p>
      <dl className="mt-6 grid gap-x-8 gap-y-3 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map(([term, value]) => (
          <div key={term} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-2">
            <dt className="text-xs text-slate-500">{term}</dt>
            <dd className="truncate font-mono text-xs tabular-nums text-slate-300">{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-6 font-mono text-[11px] tabular-nums text-slate-600">
        Exported {generated}
      </p>
    </section>
  );
}
