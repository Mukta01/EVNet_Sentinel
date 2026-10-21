"use client";

import { MODEL_LABEL, prettyClass } from "./theme";

type Scenario = {
  class: string;
  category: "dos" | "recon" | "benign";
  sender: string;
  heldOutFlows: number;
  smallSample: boolean;
  recommendedShare: number;
  actions: string[];
  attackFlowsToRecommend: number | null;
  reachedMean: number;
  blockedMean: number;
  blockedShare: number;
};

export type ReplayData = {
  model: string;
  settings: { baselineFlows: number; flowsPerScenario: number; attackShare: number; approvalDelayFlows: number; runs: number };
  summary: {
    scenarios: number;
    contained: number;
    meanBlockedShare: number;
    escalation: { coldFloodFlowsToQuarantine: number | null; afterScanFlowsToQuarantine: number | null };
    benignOnly: { flows: number; recommendations: number };
  };
  scenarios: Scenario[];
};

const SENDER: Record<string, string> = { kali: "Laptop on the wifi", rpi: "Raspberry Pi on the wifi", evcc: "Compromised car (cable)" };
const ACTION: Record<string, { label: string; cls: string }> = {
  quarantine: { label: "Quarantine", cls: "text-rose-300" },
  restrict: { label: "Restrict", cls: "text-amber-300" },
  "end-session": { label: "Stop session", cls: "text-sky-300" },
};

/**
 * What happens after a detection: every recorded attack replayed through the
 * containment policy (src/evaluation/replay_response.py), with a simulated
 * operator approving each recommendation. A replay, not live blocking.
 */
export default function ResponseReplay({ data }: { data: ReplayData }) {
  const { summary, settings } = data;
  const rows = [...data.scenarios].sort((a, b) =>
    a.category === b.category ? a.class.localeCompare(b.class) || a.sender.localeCompare(b.sender) : a.category === "dos" ? -1 : 1);
  const esc = summary.escalation;

  return (
    <section aria-labelledby="response-heading">
      <h3 id="response-heading" className="text-lg font-semibold tracking-tight text-white">
        After detection: the response, replayed
      </h3>
      <p className="mt-2 max-w-prose text-sm leading-relaxed text-slate-400">
        Detection alone doesn&rsquo;t stop an attacker. Each recorded attack was replayed through the
        containment policy using {MODEL_LABEL[data.model] ?? data.model}&rsquo;s real verdicts, mixed with
        normal traffic, with an operator approving each recommendation {settings.approvalDelayFlows} flows
        after it appears. Floods get a quarantine, scans a restriction, and a scanning car has its session
        stopped. A replay of recorded traffic, not live blocking: Sentinel is passive.
      </p>

      <dl className="mt-6 grid gap-3 sm:grid-cols-3">
        {[
          { v: `${summary.contained}/${summary.scenarios}`, l: "attacker-and-attack pairs contained", s: "every class, from the device that really sent it" },
          { v: `${esc.coldFloodFlowsToQuarantine ?? "–"} → ${esc.afterScanFlowsToQuarantine ?? "–"}`, l: "flood flows before quarantine", s: "cold, versus after the same device scanned first" },
          { v: String(summary.benignOnly.recommendations), l: "actions on normal traffic", s: `over ${summary.benignOnly.flows.toLocaleString()} benign flows` },
        ].map((x) => (
          <div key={x.l} className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <dt className="text-[12px] text-slate-400">{x.l}</dt>
            <dd className="mt-1 font-mono text-2xl tabular-nums text-white">{x.v}</dd>
            <dd className="mt-0.5 text-[11px] text-slate-500">{x.s}</dd>
          </div>
        ))}
      </dl>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[44rem] border-collapse text-sm">
          <thead>
            <tr className="border-b border-white/10 text-left text-[11px] font-medium uppercase tracking-[0.12em] text-slate-500">
              <th scope="col" className="pb-3 pr-4 font-medium">Attack</th>
              <th scope="col" className="pb-3 pr-4 font-medium">From</th>
              <th scope="col" className="pb-3 pr-4 font-medium">Action</th>
              <th scope="col" className="pb-3 pr-4 text-right font-medium">Attack flows before action</th>
              <th scope="col" className="pb-3 pr-4 text-right font-medium">Got through</th>
              <th scope="col" className="pb-3 text-right font-medium">Stopped</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.class}-${r.sender}`} className="border-b border-white/5">
                <td className="py-2.5 pr-4 text-slate-200">
                  {prettyClass(r.class)}
                  {r.smallSample && (
                    <span className="ml-2 rounded bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-slate-400"
                      title={`Only ${r.heldOutFlows} held-out flows, replayed in a loop`}>
                      {r.heldOutFlows} flows
                    </span>
                  )}
                </td>
                <td className="py-2.5 pr-4 text-slate-400">{SENDER[r.sender] ?? r.sender}</td>
                <td className="py-2.5 pr-4">
                  {r.actions.map((a) => (
                    <span key={a} className={`font-medium ${ACTION[a]?.cls ?? ""}`}>{ACTION[a]?.label ?? a}</span>
                  ))}
                  {r.recommendedShare < 1 && <span className="ml-1 text-[11px] text-slate-500">in {Math.round(r.recommendedShare * 100)}% of runs</span>}
                </td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-300">{r.attackFlowsToRecommend ?? "–"}</td>
                <td className="py-2.5 pr-4 text-right font-mono tabular-nums text-slate-300">{r.reachedMean}</td>
                <td className="py-2.5 text-right font-mono tabular-nums text-slate-300">{r.blockedMean}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 max-w-prose text-[12px] leading-relaxed text-slate-500">
        Means over {settings.runs} random interleavings of {settings.flowsPerScenario} flows ({Math.round(settings.attackShare * 100)}%
        attack) after a {settings.baselineFlows}-flow benign baseline. &ldquo;Got through&rdquo; counts attack flows that reached the
        station before the action took effect, including the {settings.approvalDelayFlows}-flow approval delay. &ldquo;Stopped&rdquo; depends on
        how long the attack runs, so read the first two columns as the result. Normal traffic comes from the dataset&rsquo;s 12
        held-out benign flows, so the zero-false-action figure is a small sample.
      </p>
    </section>
  );
}
