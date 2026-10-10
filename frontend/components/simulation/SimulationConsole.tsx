"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ListChecks, Pause, Play, Radio, Square } from "lucide-react";
import TopologyCanvas, { groupTone, type Packet } from "./TopologyCanvas";
import { BLOCKED_PATHS, SENDERS, nodeById, routeFor, type NodeId, type Sender } from "./topology";
import { FAMILY, MODEL_LABEL, prettyClass } from "../dashboard/theme";
import ResponsePanel, { type ResponseMap } from "./ResponsePanel";
import IncidentLog, { type Incident } from "./IncidentLog";
import ContainmentPanel, { type ContainmentEvent } from "./ContainmentPanel";
import { approve, initialState, observe, release, type SiteState } from "@/lib/containment";

type Verdict = {
  label: string; group: string; correct: boolean;
  confidence: number | null; runningAccuracy?: number; step?: number;
};

/**
 * Verdicts and feature values arrive packed.
 *
 * The feature spec and the model names are identical for all 2,181 flows, so
 * repeating them per flow tripled the bundle. Hoisted, the payload drops from
 * 3.4 MB to 931 KB. Packed verdict layout is `verdictSchema`:
 * [label, group, correct, confidence?, runningAccuracy?, step?].
 */
type PackedVerdict = [string, string, number, (number | null)?, number?, number?];

type Flow = {
  id: number; trueLabel: string; trueGroup: string;
  evse: string; state: string; capture: string;
  v: number[];
  p: Record<string, PackedVerdict>;
};

type FeatureSpec = { key: string; label: string; unit: string };

type Sim = {
  provenance: string; benignNote: string;
  models: string[]; onlineModels: string[];
  classes: string[]; groups: Record<string, string>;
  byClass: Record<string, number[]>;
  featureSpec: FeatureSpec[];
  flows: Flow[];
};

/**
 * The console is an operator view, so it speaks in response categories — what
 * you would act on — rather than the analytic grouping used on the findings
 * page. Every flood, including the low-rate ones, is denial of service.
 */
const categoryOf = (group: string) =>
  group === "recon" ? "recon" : group === "benign" ? "benign" : "dos";
const CATEGORY_ORDER = ["dos", "recon"] as const;
const GROUP_TITLE: Record<string, string> = {
  dos: "Denial of service",
  recon: "Reconnaissance",
  benign: "Normal traffic",
};

const EMIT_MS = { slow: 900, normal: 420, fast: 160 };

/**
 * Scripted multi-stage runs. Each opens with normal traffic, so the log also
 * records whether the detector raises false alarms before anything happens.
 */
const CAMPAIGNS = [
  { id: "kill-chain", label: "Recon → exploit → flood",
    steps: ["OS_Fingerprinting", "Service_Version_Detection", "Vulnerability_Scan", "SYN_Flood"] },
  { id: "flood-barrage", label: "Flood barrage",
    steps: ["SYN_Flood", "UDP_Flood", "ICMP_Flood", "PSHACK_Flood", "TCP_Flood"] },
  { id: "low-and-slow", label: "Low and slow",
    steps: ["SYN_Stealth_Scan", "TCP_Port_Scan", "Slowloris_Scan"] },
  { id: "full-sweep", label: "Every attack type", steps: [] as string[] },
];
/** Flows the detector must see before a campaign moves to its next stage. */
const STAGE_FLOWS = 10;

type Campaign = { id: string; steps: string[]; stage: number };

export default function SimulationConsole({
  sim, responses, roles, categorySeverity, senders,
}: {
  sim: Sim; responses: ResponseMap; roles: Record<string, string>;
  categorySeverity: Record<string, string[]>;
  /** capture file -> the device that sent its attack traffic (attack_routes.py) */
  senders: Record<string, Sender | null>;
}) {
  const byId = useMemo(() => new Map(sim.flows.map((f) => [f.id, f])), [sim.flows]);
  const modelIndex = useMemo(
    () => Object.fromEntries(sim.models.map((m, i) => [m, String(i)])),
    [sim.models],
  );
  const verdictFor = useCallback(
    (flow: Flow, name: string): Verdict | undefined => {
      const packed = flow.p[modelIndex[name]];
      if (!packed) return undefined;
      const [label, group, correct, confidence, runningAccuracy, step] = packed;
      return {
        label, group, correct: correct === 1,
        confidence: confidence ?? null,
        ...(runningAccuracy !== undefined ? { runningAccuracy, step } : {}),
      };
    },
    [modelIndex],
  );
  const attackClasses = useMemo(
    () => sim.classes.filter((c) => c !== "Benign"),
    [sim.classes],
  );

  const [attackClass, setAttackClass] = useState<string>("TCP_Port_Scan");
  const [source, setSource] = useState<Sender | "all">("all");
  const [liveSender, setLiveSender] = useState<Sender | null>(null);
  const [stationState, setStationState] = useState<"idle" | "charging">("charging");
  const [model, setModel] = useState(sim.models[0]);
  const [speed, setSpeed] = useState<keyof typeof EMIT_MS>("normal");
  const [attacking, setAttacking] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [tapPulse, setTapPulse] = useState<{ flagged: boolean; at: number } | null>(null);
  const [feed, setFeed] = useState<{ flow: Flow; verdict: Verdict }[]>([]);
  const [tally, setTally] = useState({ seen: 0, caught: 0 });
  const [current, setCurrent] = useState<Flow | null>(null);
  const [campaignId, setCampaignId] = useState(CAMPAIGNS[0].id);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  // Site threat level and simulated, operator-approved quarantine.
  const [site, setSite] = useState<SiteState>(initialState);
  const [blocked, setBlocked] = useState<Record<string, number>>({});
  const [siteEvents, setSiteEvents] = useState<ContainmentEvent[]>([]);
  // Read inside the emit loop and the tap handler, which are stable callbacks.
  const siteRef = useRef<SiteState>(initialState);

  const packets = useRef<Packet[]>([]);
  const packetFlow = useRef<Map<number, Flow>>(new Map());
  const nextKey = useRef(1);
  const cursor = useRef(0);
  const modelRef = useRef(model);
  useEffect(() => { modelRef.current = model; }, [model]);
  const verdictForRef = useRef(verdictFor);
  useEffect(() => { verdictForRef.current = verdictFor; }, [verdictFor]);
  const campaignRef = useRef(campaign);
  useEffect(() => { campaignRef.current = campaign; }, [campaign]);
  const stageSeen = useRef(0);

  // During a campaign the stage decides what is on the wire.
  const activeClass = campaign ? campaign.steps[campaign.stage] : attackClass;
  const activeIsAttack = attacking && activeClass !== "Benign";

  const benignPool = useMemo(() => sim.byClass["Benign"] ?? [], [sim.byClass]);
  const attackPool = useMemo(() => {
    let pool = sim.byClass[activeClass] ?? [];
    // Only real recordings: filtering by sender never invents a route.
    if (source !== "all") {
      const bySender = pool.filter((id) => senders[byId.get(id)?.capture ?? ""] === source);
      if (bySender.length) pool = bySender;
    }
    if (stationState === "idle") {
      const filtered = pool.filter((id) => byId.get(id)?.state === "idle");
      if (filtered.length) return filtered;
    }
    return pool;
  }, [sim.byClass, activeClass, stationState, byId, source, senders]);

  // Which devices actually sent this attack in the recordings, with flow counts.
  const recordedSenders = useMemo(() => {
    const counts = new Map<Sender, number>();
    for (const id of sim.byClass[attackClass] ?? []) {
      const s = senders[byId.get(id)?.capture ?? ""];
      if (s) counts.set(s, (counts.get(s) ?? 0) + 1);
    }
    return [...counts.entries()];
  }, [sim.byClass, attackClass, senders, byId]);

  const reset = useCallback(() => {
    packets.current = [];
    packetFlow.current.clear();
    cursor.current = 0;
    setFeed([]); setTally({ seen: 0, caught: 0 }); setCurrent(null); setTapPulse(null);
  }, []);

  /** Advance the campaign once this stage's traffic has been judged (or blocked). */
  const advanceCampaign = useCallback((label: string) => {
    const run = campaignRef.current;
    if (!run || label !== run.steps[run.stage]) return;
    stageSeen.current += 1;
    if (stageSeen.current < STAGE_FLOWS) return;
    stageSeen.current = 0;
    const done = run.stage + 1 >= run.steps.length;
    const nextRun = done ? null : { ...run, stage: run.stage + 1 };
    campaignRef.current = nextRun;
    setCampaign(nextRun);
    cursor.current = 0;
    if (done) setAttacking(false);
  }, []);

  // Emit packets on a cadence. Benign loops while idle; launching swaps the pool.
  useEffect(() => {
    if (!streaming) return;
    const pool = activeIsAttack ? attackPool : benignPool;
    if (!pool.length) return;

    const id = setInterval(() => {
      if (packets.current.length > 26) return; // keep the wire legible
      const flowId = pool[cursor.current % pool.length];
      cursor.current += 1;
      const flow = byId.get(flowId);
      if (!flow) return;
      const key = nextKey.current++;
      packetFlow.current.set(key, flow);
      const sender = activeIsAttack ? senders[flow.capture] ?? "kali" : null;
      if (sender && siteRef.current.quarantined.includes(sender)) {
        // Quarantined: the switch drops it before the tap. Normal traffic keeps
        // flowing, so the site can cool down.
        packets.current.push({
          key: nextKey.current++, pathD: BLOCKED_PATHS[sender], target: null,
          startedAt: performance.now(), duration: 0, progress: 0,
          tone: groupTone(flow.trueGroup), caught: null, fired: false, blocked: true,
        });
        setBlocked((b) => ({ ...b, [sender]: (b[sender] ?? 0) + 1 }));
        advanceCampaign(flow.trueLabel);
        const benign = byId.get(benignPool[cursor.current % Math.max(1, benignPool.length)]);
        if (!benign) return;
        const bkey = nextKey.current++;
        packetFlow.current.set(bkey, benign);
        packets.current.push({
          key: bkey, pathD: routeFor(benign.evse, null, false).pathD, target: null,
          startedAt: performance.now(), duration: 0, progress: 0,
          tone: groupTone(benign.trueGroup), caught: null, fired: false,
        });
        return;
      }
      const route = routeFor(flow.evse, sender, activeIsAttack);
      if (sender) setLiveSender(sender);
      packets.current.push({
        key,
        pathD: route.pathD,
        target: route.target,
        startedAt: performance.now(),
        duration: 0, // filled from real path length on the first frame
        progress: 0,
        tone: groupTone(flow.trueGroup),
        caught: null,
        fired: false,
      });
    }, EMIT_MS[speed]);
    return () => clearInterval(id);
  }, [streaming, activeIsAttack, attackPool, benignPool, byId, speed, senders, advanceCampaign]);

  const stamp = () => new Date().toLocaleTimeString([], { hour12: false });
  const nameOf = (x: string) => SENDERS[x as Sender]?.label ?? x;
  const logSite = useCallback((e: ContainmentEvent[]) => {
    if (e.length) setSiteEvents((prev) => [...e, ...prev].slice(0, 30));
  }, []);
  /** Single place the site state changes, so events are logged from the transition itself. */
  const updateSite = useCallback((next: SiteState, extra: ContainmentEvent[] = []) => {
    const prev = siteRef.current;
    const at = new Date().toLocaleTimeString([], { hour12: false });
    const add: ContainmentEvent[] = [...extra];
    if (next.level !== prev.level) add.push({ at, kind: "level", text: `Site ${prev.level} → ${next.level}` });
    if (next.recommendation && next.recommendation !== prev.recommendation)
      add.push({ at, kind: "recommend", text: `Quarantine recommended: ${SENDERS[next.recommendation as Sender]?.label ?? next.recommendation}` });
    siteRef.current = next;
    setSite(next);
    logSite(add);
  }, [logSite]);

  const approveQuarantine = (sender: string) =>
    updateSite(approve(siteRef.current, sender),
      [{ at: stamp(), kind: "quarantine", text: `Operator approved quarantine: ${nameOf(sender)}` }]);
  const releaseQuarantine = (sender: string) =>
    updateSite(release(siteRef.current, sender),
      [{ at: stamp(), kind: "release", text: `Released: ${nameOf(sender)}` }]);

  const handleTap = useCallback((key: number) => {
    const flow = packetFlow.current.get(key);
    if (!flow) return;
    const verdict = verdictForRef.current(flow, modelRef.current);
    if (!verdict) return;

    const packet = packets.current.find((p) => p.key === key);
    if (packet) packet.caught = verdict.correct;

    setTapPulse({ flagged: verdict.label !== "Benign", at: Date.now() });
    setCurrent(flow);
    setFeed((prev) => [{ flow, verdict }, ...prev].slice(0, 40));
    setTally((prev) => ({ seen: prev.seen + 1, caught: prev.caught + (verdict.correct ? 1 : 0) }));
    packetFlow.current.delete(key);

    // Log it: one incident per (model, true attack), in order of first sighting.
    const name = modelRef.current;
    const trueCat = categoryOf(flow.trueGroup);
    const calledCat = categoryOf(verdict.group);
    setIncidents((prev) => {
      const at = prev.findIndex((r) => r.model === name && r.label === flow.trueLabel);
      const base: Incident = at >= 0 ? prev[at] : {
        model: name, label: flow.trueLabel, category: trueCat,
        firstSeen: new Date().toLocaleTimeString([], { hour12: false }),
        seen: 0, flagged: 0, exact: 0, sameCategory: 0, calls: {},
      };
      const next: Incident = {
        ...base,
        seen: base.seen + 1,
        flagged: base.flagged + (verdict.label !== "Benign" ? 1 : 0),
        exact: base.exact + (verdict.label === flow.trueLabel ? 1 : 0),
        sameCategory: base.sameCategory + (calledCat === trueCat ? 1 : 0),
        calls: { ...base.calls, [verdict.label]: (base.calls[verdict.label] ?? 0) + 1 },
      };
      return at >= 0 ? prev.map((r, i) => (i === at ? next : r)) : [...prev, next];
    });

    // Feed the site threat level. The sender is the device the flow came from.
    const sender = flow.trueLabel !== "Benign" ? senders[flow.capture] ?? null : null;
    updateSite(observe(siteRef.current, {
      flagged: verdict.label !== "Benign",
      category: calledCat as "dos" | "recon" | "benign",
      confidence: verdict.confidence,
      sender,
    }));

    advanceCampaign(flow.trueLabel);
  }, [senders, advanceCampaign, updateSite]);

  const rate = tally.seen ? tally.caught / tally.seen : null;
  const isOnline = sim.onlineModels.includes(model);
  const latestArf = feed.find((f) => f.verdict.runningAccuracy !== undefined)?.verdict;
  const selected = selectedNode ? nodeById(selectedNode) : null;

  const launchAttack = () => { reset(); setCampaign(null); setAttacking(true); setStreaming(true); };
  const stopAttack = () => { reset(); setCampaign(null); setAttacking(false); setStreaming(true); };
  const runCampaign = () => {
    const preset = CAMPAIGNS.find((c) => c.id === campaignId)!;
    const steps = (preset.steps.length ? preset.steps : attackClasses).filter((c) => sim.byClass[c]?.length);
    reset();
    stageSeen.current = 0;
    setCampaign({ id: preset.id, steps: ["Benign", ...steps], stage: 0 });
    setAttacking(true);
    setStreaming(true);
  };
  const campaignLabel = campaign ? CAMPAIGNS.find((c) => c.id === campaign.id)?.label : null;

  return (
    <div className="space-y-4">
    <div className="grid gap-4 lg:grid-cols-[15rem_minmax(0,1fr)_17rem]">
      {/* ── attack control ─────────────────────────────────── */}
      <aside className="space-y-4">
        <Panel title="Attack control">
          <label className="block text-[11px] text-slate-500" htmlFor="attack-class">Attack type</label>
          <select
            id="attack-class" value={attackClass}
            onChange={(e) => { setAttackClass(e.target.value); if (attacking) reset(); }}
            className="mt-1.5 w-full rounded-md border border-white/10 bg-[#0B1220] px-2.5 py-2 text-[13px] text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            {CATEGORY_ORDER.map((g) => {
              const members = attackClasses.filter((c) => categoryOf(sim.groups[c]) === g);
              if (!members.length) return null;
              return (
                <optgroup key={g} label={`${GROUP_TITLE[g]} · ${members.length}`}>
                  {members.map((c) => <option key={c} value={c}>{prettyClass(c)}</option>)}
                </optgroup>
              );
            })}
          </select>
          <GroupChip group={sim.groups[attackClass]} className="mt-2" />
          <p className="mt-1.5 font-mono text-[10px] tabular-nums text-slate-600">
            {(sim.byClass[attackClass] ?? []).length} held-out flows available
          </p>

          <label className="mt-4 block text-[11px] text-slate-500" htmlFor="sent-from">Sent from (as recorded)</label>
          <select
            id="sent-from" value={recordedSenders.some(([k]) => k === source) ? source : "all"}
            onChange={(e) => { setSource(e.target.value as Sender | "all"); if (attacking) reset(); }}
            className="mt-1.5 w-full rounded-md border border-white/10 bg-[#0B1220] px-2.5 py-2 text-[13px] text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            <option value="all">Every recorded sender</option>
            {recordedSenders.map(([k, n]) => <option key={k} value={k}>{SENDERS[k].label} · {n} flows</option>)}
          </select>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {recordedSenders.length === 1
              ? `Only ever sent by the ${SENDERS[recordedSenders[0][0]].label}, ${SENDERS[recordedSenders[0][0]].note}.`
              : "Each packet travels from the device that really sent it to the station it really hit."}
          </p>

          <button
            onClick={attacking && !campaign ? stopAttack : launchAttack}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
              attacking && !campaign
                ? "bg-rose-500/12 text-rose-300 ring-rose-500/25 hover:bg-rose-500/20"
                : "bg-emerald-500/12 text-emerald-300 ring-emerald-500/25 hover:bg-emerald-500/20"
            }`}
          >
            {attacking && !campaign ? <><Square className="h-3.5 w-3.5" aria-hidden />Stop attack</>
                       : <><Radio className="h-4 w-4" aria-hidden />Launch attack</>}
          </button>
        </Panel>

        <Panel title="Campaign">
          <label className="block text-[11px] text-slate-500" htmlFor="campaign">Scripted sequence</label>
          <select
            id="campaign" value={campaignId} onChange={(e) => setCampaignId(e.target.value)}
            disabled={!!campaign}
            className="mt-1.5 w-full rounded-md border border-white/10 bg-[#0B1220] px-2.5 py-2 text-[13px] text-slate-100 disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            {CAMPAIGNS.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
          </select>
          {campaign ? (
            <>
              <ol className="mt-3 space-y-1">
                {campaign.steps.map((step, i) => (
                  <li key={step} className={`flex items-center gap-2 text-[11.5px] ${
                    i === campaign.stage ? "text-slate-100" : i < campaign.stage ? "text-slate-500 line-through decoration-slate-600" : "text-slate-500"
                  }`}>
                    <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${
                      i === campaign.stage ? "bg-emerald-400" : i < campaign.stage ? "bg-slate-600" : "bg-slate-700"
                    }`} />
                    {step === "Benign" ? "Normal traffic (baseline)" : prettyClass(step)}
                  </li>
                ))}
              </ol>
              <button onClick={stopAttack}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-rose-500/12 px-3 py-2 text-sm font-medium text-rose-300 ring-1 ring-inset ring-rose-500/25 hover:bg-rose-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                <Square className="h-3.5 w-3.5" aria-hidden />Stop campaign
              </button>
            </>
          ) : (
            <>
              <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
                Normal traffic first, then each attack for {STAGE_FLOWS} judged flows. Results collect in the incident log.
              </p>
              <button onClick={runCampaign}
                className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-md bg-sky-500/12 px-3 py-2 text-sm font-medium text-sky-300 ring-1 ring-inset ring-sky-500/25 hover:bg-sky-500/20 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                <ListChecks className="h-4 w-4" aria-hidden />Run campaign
              </button>
            </>
          )}
        </Panel>

        <Panel title="Station state">
          <div className="grid grid-cols-2 gap-1 rounded-md border border-white/8 p-1">
            {(["idle", "charging"] as const).map((s) => (
              <button
                key={s} onClick={() => { setStationState(s); if (attacking) reset(); }}
                aria-pressed={stationState === s}
                className={`rounded px-2 py-1.5 text-xs transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                  stationState === s ? "bg-white/10 text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >{s}</button>
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-500">
            Filters the pool by the flow&rsquo;s real <code className="font-mono">state</code> metadata.
          </p>
        </Panel>

        <Panel title="Wire speed">
          <div className="grid grid-cols-3 gap-1 rounded-md border border-white/8 p-1">
            {(Object.keys(EMIT_MS) as (keyof typeof EMIT_MS)[]).map((s) => (
              <button
                key={s} onClick={() => setSpeed(s)} aria-pressed={speed === s}
                className={`rounded px-1 py-1.5 text-[11px] transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
                  speed === s ? "bg-white/10 text-slate-100" : "text-slate-500 hover:text-slate-300"
                }`}
              >{s}</button>
            ))}
          </div>
          <button
            onClick={() => setStreaming((v) => !v)}
            className="mt-2 inline-flex w-full items-center justify-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-slate-400 transition-colors hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
          >
            {streaming ? <><Pause className="h-3.5 w-3.5" aria-hidden />Pause wire</>
                       : <><Play className="h-3.5 w-3.5" aria-hidden />Resume wire</>}
          </button>
        </Panel>
      </aside>

      {/* ── canvas ─────────────────────────────────────────── */}
      <section className="space-y-4">
        <div className="rounded-lg border border-white/8 bg-white/[0.02] p-3">
          <div className="mb-1 flex flex-wrap items-center justify-between gap-2 px-1">
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-slate-500">
              CICEVSE2024 testbed
            </span>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              {campaign
                ? `${campaignLabel} · stage ${campaign.stage + 1}/${campaign.steps.length} · ${activeClass === "Benign" ? "baseline" : prettyClass(activeClass)}`
                : attacking ? `${prettyClass(attackClass)} · ${liveSender ? SENDERS[liveSender].label : "attacker"} → charging station`
                : "benign heartbeat · looping 12 held-out flows"}
            </span>
          </div>
          <TopologyCanvas
            packets={packets} onTap={handleTap}
            selected={selectedNode} onSelect={setSelectedNode}
            tapPulse={tapPulse} running={streaming} sender={attacking ? liveSender : null}
            quarantined={site.quarantined}
          />
        </div>

        <ContainmentPanel state={site} blocked={blocked} events={siteEvents}
          onApprove={approveQuarantine} onRelease={releaseQuarantine} />

        {selected && (
          <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-medium text-slate-100">{selected.name}</h3>
              <button onClick={() => setSelectedNode(null)}
                className="text-xs text-slate-500 hover:text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                close
              </button>
            </div>
            <dl className="mt-3 grid gap-x-6 gap-y-1.5 sm:grid-cols-2">
              {[["Role", selected.role], ["Device", selected.device],
                ["Interface", selected.iface], ["Address", selected.address]].map(([k, v]) => (
                <div key={k} className="flex items-baseline justify-between gap-3 border-b border-white/5 pb-1">
                  <dt className="text-xs text-slate-500">{k}</dt>
                  <dd className="font-mono text-xs text-slate-300">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        )}

        <FlowInspector flow={current} model={model} spec={sim.featureSpec} verdictFor={verdictFor}
          sender={current && current.trueLabel !== "Benign" ? senders[current.capture] ?? null : null} />
        <ResponsePanel
          truth={current?.trueLabel ?? null}
          predicted={current ? verdictFor(current, model)?.label ?? null : null}
          model={model}
          responses={responses}
          roles={roles}
          categorySeverity={categorySeverity}
        />
      </section>

      {/* ── detector ───────────────────────────────────────── */}
      <aside className="space-y-4">
        <Panel title="Detector">
          <label className="sr-only" htmlFor="detector-model">Model</label>
          <select
            id="detector-model" value={model} onChange={(e) => setModel(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-[#0B1220] px-2.5 py-2 text-[13px] text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            {sim.models.map((m) => (
              <option key={m} value={m}>
                {MODEL_LABEL[m] ?? m.replace(/_/g, " ")}{sim.onlineModels.includes(m) ? " · online" : ""}
              </option>
            ))}
          </select>
          {isOnline && (
            <p className="mt-2 text-[11px] leading-snug text-slate-500">
              Learns as the stream runs. Verdicts come from one recorded prequential pass, so its
              accuracy reflects how much it had already seen.
            </p>
          )}

          <div className="mt-4 border-t border-white/8 pt-3">
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500">Detection rate</p>
            <p className="mt-1 font-mono text-3xl tabular-nums text-white">
              {rate === null ? "—" : `${(rate * 100).toFixed(0)}%`}
            </p>
            <p className="mt-0.5 font-mono text-[11px] tabular-nums text-slate-500">
              {tally.caught} of {tally.seen} classified correctly
            </p>
            {isOnline && latestArf?.runningAccuracy !== undefined && (
              <p className="mt-1.5 font-mono text-[11px] tabular-nums text-emerald-300/80">
                ARF running accuracy {(latestArf.runningAccuracy * 100).toFixed(1)}% at step {latestArf.step}
              </p>
            )}
          </div>
        </Panel>

        <Panel title="Verdict feed">
          {feed.length === 0 ? (
            <p className="text-[11px] leading-relaxed text-slate-500">
              Verdicts appear as packets cross the tap.
            </p>
          ) : (
            <ul className="space-y-2">
              {feed.slice(0, 9).map(({ flow, verdict }, i) => (
                <li key={`${flow.id}-${i}`} className="border-b border-white/5 pb-2 last:border-0">
                  <div className="flex items-start gap-1.5">
                    <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full"
                      style={{ background: verdict.correct ? "#22C55E" : "#F43F5E" }} />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[11.5px] text-slate-300">{prettyClass(flow.trueLabel)}</p>
                      <GroupChip group={flow.trueGroup} tiny />
                      {!verdict.correct && (
                        <p className="mt-1 truncate font-mono text-[10.5px] text-rose-300/85">
                          called {prettyClass(verdict.label)}
                          <span className="text-slate-600"> · {GROUP_TITLE[categoryOf(verdict.group)]}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </aside>
    </div>
    <IncidentLog incidents={incidents} onClear={() => setIncidents([])} />
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <h3 className="mb-3 text-[11px] uppercase tracking-[0.14em] text-slate-500">{title}</h3>
      {children}
    </div>
  );
}

function GroupChip({ group, tiny, className = "" }: { group: string; tiny?: boolean; className?: string }) {
  const cat = categoryOf(group);
  const tone =
    cat === "benign" ? { dim: "rgba(56,189,248,0.16)", stroke: "#38BDF8" }
    : cat === "recon" ? { dim: FAMILY.recon.dim, stroke: FAMILY.recon.stroke }
    : { dim: "rgba(167,139,250,0.16)", stroke: "#C4B5FD" };
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-medium uppercase tracking-wide ${
        tiny ? "mt-0.5 text-[9px]" : "text-[10px]"
      } ${className}`}
      style={{ background: tone.dim, color: tone.stroke }}
    >
      {GROUP_TITLE[cat]}
    </span>
  );
}

function FlowInspector({
  flow, model, spec, verdictFor, sender,
}: {
  flow: Flow | null; model: string; spec: FeatureSpec[];
  verdictFor: (flow: Flow, name: string) => Verdict | undefined;
  sender: Sender | null;
}) {
  const verdict = flow ? verdictFor(flow, model) : undefined;
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Flow inspector — packet at the tap
        </h3>
        {flow && <span className="font-mono text-[10px] tabular-nums text-slate-600">
          flow #{flow.id} · {sender ? `${SENDERS[sender].label} → ` : ""}{flow.evse} · {flow.state}
        </span>}
      </div>

      {!flow ? (
        <p className="text-[12px] text-slate-500">
          Launch an attack, or watch the benign heartbeat, to inspect a packet.
        </p>
      ) : (
        <>
          <dl className="grid gap-x-6 gap-y-1.5 sm:grid-cols-3">
            {spec.map((f, i) => {
              const value = flow.v[i];
              return (
                <div key={f.key} className="flex items-baseline justify-between gap-2 border-b border-white/5 pb-1">
                  <dt className="truncate text-[11px] text-slate-500">{f.label}</dt>
                  <dd className="font-mono text-[11px] tabular-nums text-slate-200">
                    {Math.abs(value) >= 1000 ? Math.round(value).toLocaleString("en-US")
                      : Number.isInteger(value) ? value : value.toFixed(2)}
                    {f.unit ? ` ${f.unit}` : ""}
                  </dd>
                </div>
              );
            })}
          </dl>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-white/8 px-3 py-2.5">
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">Ground truth</p>
              <p className="mt-1 text-[13px] text-slate-100">{prettyClass(flow.trueLabel)}</p>
              <GroupChip group={flow.trueGroup} className="mt-1.5" />
            </div>
            <div className="rounded-md px-3 py-2.5 ring-1 ring-inset"
              style={{
                background: verdict?.correct ? "rgba(34,197,94,0.08)" : "rgba(244,63,94,0.08)",
                ["--tw-ring-color" as string]: verdict?.correct ? "rgba(34,197,94,0.28)" : "rgba(244,63,94,0.28)",
              }}>
              <p className="text-[10px] uppercase tracking-[0.14em] text-slate-500">
                {MODEL_LABEL[model] ?? model.replace(/_/g, " ")} called it
              </p>
              <p className={`mt-1 text-[13px] ${verdict?.correct ? "text-emerald-200" : "text-rose-200"}`}>
                {verdict ? prettyClass(verdict.label) : "—"}
              </p>
              {verdict && <GroupChip group={verdict.group} className="mt-1.5" />}
              {verdict?.confidence != null && (
                <p className="mt-1.5 font-mono text-[10px] tabular-nums text-slate-500">
                  confidence {(verdict.confidence * 100).toFixed(1)}%
                </p>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
