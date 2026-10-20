"use client";

import { Ban, Eye, PlugZap, ShieldAlert, ShieldCheck, ShieldHalf, ShieldX, Unlock } from "lucide-react";
import {
  POLICY, containedSenders, flaggedShare,
  type Action, type Level, type Recommendation, type SiteState,
} from "@/lib/containment";
import { SENDERS, type Sender } from "./topology";

export type ContainmentEvent = { at: string; kind: "level" | "recommend" | "quarantine" | "release"; text: string };

/** How each action is carried out, from response_playbook.json via insights.json. */
export type ContainmentGuide = Record<Action, {
  label: string; when: string; who: string; how: string[]; effect: string; undo: string;
}>;

export const ACTION_LABEL: Record<Action, string> = {
  quarantine: "Quarantine",
  restrict: "Restriction",
  "end-session": "Session stop",
};

const ACTION_UI: Record<Action, { verb: string; done: string; Icon: typeof Ban; tone: string }> = {
  quarantine: { verb: "Approve quarantine", done: "quarantined", Icon: Ban, tone: "rose" },
  restrict: { verb: "Approve restriction", done: "restricted from the chargers", Icon: ShieldHalf, tone: "amber" },
  "end-session": { verb: "Stop session and block vehicle", done: "session stopped, vehicle blocked", Icon: PlugZap, tone: "amber" },
};

const WHO: Record<string, string> = { owner: "Station owner", csms: "CSMS operator", analyst: "Network analyst" };

const LEVEL_UI: Record<Level, { label: string; note: string; color: string; bg: string; Icon: typeof ShieldCheck }> = {
  safe: { label: "Safe", note: "Traffic looks normal.", color: "#86EFAC", bg: "rgba(34,197,94,0.12)", Icon: ShieldCheck },
  elevated: { label: "Elevated", note: "Some flows are being flagged. Watch closely.", color: "#FCD34D", bg: "rgba(245,158,11,0.12)", Icon: ShieldAlert },
  unsafe: { label: "Network not safe", note: "Most recent flows are attacks.", color: "#FDA4AF", bg: "rgba(244,63,94,0.14)", Icon: ShieldX },
};

const MAC: Record<Sender, string> = { kali: "a8:6b:ad:1f:9b:e5", rpi: "dc:a6:32:dc:27:d5", evcc: "dc:a6:32:c9:e6:9f" };
const deviceName = (s: string) => SENDERS[s as Sender]?.label ?? s;

const STAGES = ["Detect", "Contain", "Harden", "Verify"] as const;

function stageOf(state: SiteState): number {
  if (state.recommendation) return 1;
  if (containedSenders(state).length) return state.level === "safe" ? 3 : 2;
  return 0;
}

function why(rec: Recommendation) {
  if (rec.reason === "escalation")
    return `It scanned the site earlier and has now sent ${POLICY.escalate.minDetections}+ denial-of-service flows. A scan followed by an attack is the classic pattern, so the bar is lower.`;
  if (rec.reason === "flood")
    return `${POLICY.quarantine.minDetections}+ denial-of-service flows from this device at ≥${Math.round(POLICY.quarantine.minConfidence * 100)}% confidence. Floods are named almost perfectly, so the evidence is strong enough to cut it off.`;
  return `${POLICY.restrict.minDetections}+ scans recognised from this device. Scans are recognised as scans reliably but named exactly only about a third of the time, so this acts on the category and stops short of a full quarantine.`;
}

/**
 * The closed loop for one site: the verdict stream sets a threat level, the
 * policy recommends one containment action per attacking device (quarantine,
 * restrict, or stop a vehicle's session), an operator approves it, and the
 * blocked-flow counts verify it worked. Rules: data/containment-policy.json.
 */
export default function ContainmentPanel({
  state, blocked, events, guide, onApprove, onRelease,
}: {
  state: SiteState;
  blocked: Record<string, number>;
  events: ContainmentEvent[];
  guide: ContainmentGuide;
  onApprove: (sender: string, action: Action) => void;
  onRelease: (sender: string) => void;
}) {
  const ui = LEVEL_UI[state.level];
  const share = flaggedShare(state);
  const stage = stageOf(state);
  const rec = state.recommendation;
  const contained = Object.entries(state.contained) as [string, Action][];
  const watchedOnly = state.watched.filter((s) => !(s in state.contained));

  return (
    <section className="rounded-lg border border-white/8 bg-white/[0.02] p-4" aria-labelledby="containment-heading">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="containment-heading" className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Site status &amp; response
        </h3>
        <span className="text-[10px] uppercase tracking-wide text-slate-600">simulated · operator-approved</span>
      </div>

      <ol className="mt-3 grid grid-cols-4 gap-1" aria-label="Response loop">
        {STAGES.map((s, i) => (
          <li key={s} aria-current={i === stage ? "step" : undefined}
            className={`rounded px-1.5 py-1 text-center text-[10.5px] font-medium transition-colors ${
              i === stage ? "bg-emerald-500/20 text-emerald-200" : i < stage ? "bg-white/[0.05] text-slate-300" : "bg-white/[0.02] text-slate-600"
            }`}>
            {i + 1} · {s}
          </li>
        ))}
      </ol>

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

      {rec && (() => {
        const a = ACTION_UI[rec.action];
        const g = guide[rec.action];
        const danger = rec.action === "quarantine";
        return (
          <div className={`mt-3 rounded-md border p-3 ${danger ? "border-rose-400/30 bg-rose-500/[0.06]" : "border-amber-400/30 bg-amber-500/[0.06]"}`}>
            <p className={`text-[13px] ${danger ? "text-rose-100" : "text-amber-100"}`}>
              {rec.reason === "escalation" && <span className="mr-1.5 rounded bg-rose-500/30 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">escalation</span>}
              Recommend: <strong>{g?.label ?? ACTION_LABEL[rec.action]}</strong>, {deviceName(rec.sender)}
              <span className="ml-1 font-mono text-[11px] opacity-70">{MAC[rec.sender as Sender]}</span>
            </p>
            <p className="mt-1 text-[11px] leading-snug text-slate-400">{why(rec)}</p>
            {g && (
              <div className="mt-2 border-t border-white/5 pt-2">
                <p className="text-[10.5px] uppercase tracking-wide text-slate-500">{WHO[g.who] ?? g.who} does</p>
                <ul className="mt-1 list-disc space-y-0.5 pl-4 text-[11px] leading-snug text-slate-300">
                  {g.how.map((h) => <li key={h}>{h}</li>)}
                </ul>
                <p className="mt-1.5 text-[11px] leading-snug text-slate-400">{g.effect}</p>
              </div>
            )}
            <button onClick={() => onApprove(rec.sender, rec.action)}
              className={`mt-2 inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium text-white transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 ${
                danger ? "bg-rose-500/90 hover:bg-rose-500 focus-visible:outline-rose-300" : "bg-amber-600/90 hover:bg-amber-600 focus-visible:outline-amber-300"
              }`}>
              <a.Icon className="h-3.5 w-3.5" aria-hidden />{a.verb}
            </button>
          </div>
        );
      })()}

      {contained.length > 0 && (
        <div className="mt-3">
          <p className="text-[10.5px] uppercase tracking-wide text-slate-500">Verify · attack flows stopped</p>
          <ul className="mt-1 space-y-1.5">
            {contained.map(([s, action]) => {
              const a = ACTION_UI[action];
              return (
                <li key={s} className="flex items-center justify-between gap-2 rounded-md bg-white/[0.03] px-2.5 py-1.5 text-xs">
                  <span className="text-slate-300">
                    <a.Icon className={`mr-1 inline h-3 w-3 ${action === "quarantine" ? "text-rose-300" : "text-amber-300"}`} aria-hidden />
                    {deviceName(s)} {a.done}
                    <span className="text-slate-500"> · {blocked[s] ?? 0} attack flows stopped</span>
                  </span>
                  <button onClick={() => onRelease(s)} title={guide[action]?.undo}
                    className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                    <Unlock className="h-3 w-3" aria-hidden />release
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            Harden next: the recommended response below lists what each role changes so the same attack fails next time.
          </p>
        </div>
      )}

      {watchedOnly.length > 0 && (
        <p className="mt-3 flex items-start gap-1.5 rounded-md bg-white/[0.03] p-2.5 text-[11px] leading-snug text-slate-400">
          <Eye className="mt-0.5 h-3 w-3 shrink-0 text-amber-300" aria-hidden />
          <span>
            Watching {watchedOnly.map(deviceName).join(", ")}: it scanned the site. If it sends{" "}
            {POLICY.escalate.minDetections} denial-of-service flows, Sentinel recommends a quarantine straight away.
          </span>
        </p>
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
