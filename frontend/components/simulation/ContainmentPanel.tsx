"use client";

import { Ban, ShieldAlert, ShieldCheck, ShieldX, Unlock } from "lucide-react";
import { POLICY, flaggedShare, type Level, type SiteState } from "@/lib/containment";
import { SENDERS, type Sender } from "./topology";

export type ContainmentEvent = { at: string; kind: "level" | "recommend" | "quarantine" | "release"; text: string };

const LEVEL_UI: Record<Level, { label: string; note: string; color: string; bg: string; Icon: typeof ShieldCheck }> = {
  safe: { label: "Safe", note: "Traffic looks normal.", color: "#86EFAC", bg: "rgba(34,197,94,0.12)", Icon: ShieldCheck },
  elevated: { label: "Elevated", note: "Some flows are being flagged. Watch closely.", color: "#FCD34D", bg: "rgba(245,158,11,0.12)", Icon: ShieldAlert },
  unsafe: { label: "Network not safe", note: "Most recent flows are attacks.", color: "#FDA4AF", bg: "rgba(244,63,94,0.14)", Icon: ShieldX },
};

const MAC: Record<Sender, string> = { kali: "a8:6b:ad:1f:9b:e5", rpi: "dc:a6:32:dc:27:d5", evcc: "dc:a6:32:c9:e6:9f" };
const deviceName = (s: string) => SENDERS[s as Sender]?.label ?? s;

/**
 * Turns the verdict stream into a site threat level and, for confident
 * denial-of-service detections from an identified device, a quarantine the
 * operator can approve. Rules: data/containment-policy.json.
 */
export default function ContainmentPanel({
  state, blocked, events, onApprove, onRelease,
}: {
  state: SiteState;
  blocked: Record<string, number>;
  events: ContainmentEvent[];
  onApprove: (sender: string) => void;
  onRelease: (sender: string) => void;
}) {
  const ui = LEVEL_UI[state.level];
  const share = flaggedShare(state);
  const scanOnly = state.level === "unsafe" && !state.recommendation
    && state.window.filter((o) => o.flagged).every((o) => o.category === "recon");

  return (
    <section className="rounded-lg border border-white/8 bg-white/[0.02] p-4" aria-labelledby="containment-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="containment-heading" className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Site status &amp; containment
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-600">simulated · operator-approved</span>
      </div>

      <div className="mt-3 flex items-center gap-3 rounded-md px-3 py-2.5" style={{ background: ui.bg }} role="status" aria-live="polite">
        <ui.Icon className="h-5 w-5 shrink-0" style={{ color: ui.color }} aria-hidden />
        <div className="min-w-0">
          <p className="text-sm font-semibold" style={{ color: ui.color }}>{ui.label}</p>
          <p className="text-[11px] text-slate-400">{ui.note}</p>
        </div>
      </div>

      {/* flagged share over the sliding window, with the two thresholds */}
      <div className="mt-3">
        <div className="flex justify-between text-[11px] text-slate-500">
          <span>Flagged in last {state.window.length}/{POLICY.window} flows</span>
          <span className="font-mono tabular-nums text-slate-300">{Math.round(share * 100)}%</span>
        </div>
        <div className="relative mt-1 h-2 rounded-full bg-white/8">
          <div className="h-2 rounded-full transition-[width] duration-300"
            style={{ width: `${share * 100}%`, background: ui.color }} />
          {[POLICY.elevatedShare, POLICY.unsafeShare].map((t) => (
            <span key={t} className="absolute -top-0.5 h-3 w-px bg-slate-400/70" style={{ left: `${t * 100}%` }}
              title={`${Math.round(t * 100)}% threshold`} />
          ))}
        </div>
        <p className="mt-1 text-[10px] text-slate-600">
          Elevated at {Math.round(POLICY.elevatedShare * 100)}%, not safe at {Math.round(POLICY.unsafeShare * 100)}%;
          steps down after {POLICY.cooldownFlows} quiet flows.
        </p>
      </div>

      {state.recommendation && (
        <div className="mt-3 rounded-md border border-rose-400/30 bg-rose-500/[0.06] p-3">
          <p className="text-[13px] text-rose-100">
            Recommend quarantining <strong>{deviceName(state.recommendation)}</strong>
            <span className="ml-1 font-mono text-[11px] text-rose-200/70">{MAC[state.recommendation as Sender]}</span>
          </p>
          <p className="mt-1 text-[11px] text-slate-400">
            {POLICY.quarantine.minDetections}+ denial-of-service flows from this device at ≥{" "}
            {Math.round(POLICY.quarantine.minConfidence * 100)}% confidence. Blocks only this device at the switch;
            the chargers and CSMS stay online.
          </p>
          <button onClick={() => onApprove(state.recommendation!)}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-rose-500/90 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-rose-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-300">
            <Ban className="h-3.5 w-3.5" aria-hidden />Approve quarantine
          </button>
        </div>
      )}

      {scanOnly && (
        <p className="mt-3 rounded-md bg-white/[0.03] p-2.5 text-[11px] leading-snug text-slate-400">
          Reconnaissance only: no quarantine is recommended. Scans are named correctly about a third of the
          time, too weak to cut a device off. Investigate the source instead.
        </p>
      )}

      {state.quarantined.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {state.quarantined.map((s) => (
            <li key={s} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 text-xs">
              <span className="text-slate-300">
                <Ban className="mr-1 inline h-3 w-3 text-rose-300" aria-hidden />
                {deviceName(s)} quarantined
                <span className="text-slate-500"> · {blocked[s] ?? 0} flows blocked</span>
              </span>
              <button onClick={() => onRelease(s)}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                <Unlock className="h-3 w-3" aria-hidden />release
              </button>
            </li>
          ))}
        </ul>
      )}

      {events.length > 0 && (
        <ol className="mt-3 max-h-36 space-y-1 overflow-y-auto border-t border-white/5 pt-2 font-mono text-[11px]">
          {events.map((e, i) => (
            <li key={i} className="flex gap-2 text-slate-400">
              <span className="tabular-nums text-slate-600">{e.at}</span>
              <span className={e.kind === "quarantine" ? "text-rose-200" : e.kind === "release" ? "text-emerald-200" : ""}>{e.text}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
