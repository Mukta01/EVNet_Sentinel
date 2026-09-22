"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Pause, Play, Radio, Square } from "lucide-react";
import TopologyCanvas, { groupTone, type Packet } from "./TopologyCanvas";
import { LAUNCH_POINTS, nodeById, pathForFlow, type NodeId } from "./topology";
import { FAMILY, MODEL_LABEL, prettyClass } from "../dashboard/theme";

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

const GROUP_ORDER = ["volumetric", "recon", "other"] as const;
const GROUP_TITLE: Record<string, string> = {
  volumetric: "Volumetric flood",
  recon: "Reconnaissance",
  other: "Low-rate or sparse",
  benign: "Benign",
};

const EMIT_MS = { slow: 900, normal: 420, fast: 160 };

export default function SimulationConsole({ sim }: { sim: Sim }) {
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
  const [launchPoint, setLaunchPoint] = useState(LAUNCH_POINTS[0].id);
  const [stationState, setStationState] = useState<"idle" | "charging">("charging");
  const [model, setModel] = useState(sim.models[0]);
  const [speed, setSpeed] = useState<keyof typeof EMIT_MS>("normal");
  const [attacking, setAttacking] = useState(false);
  const [streaming, setStreaming] = useState(true);
  const [selectedNode, setSelectedNode] = useState<NodeId | null>(null);
  const [tapPulse, setTapPulse] = useState<{ caught: boolean; at: number } | null>(null);
  const [feed, setFeed] = useState<{ flow: Flow; verdict: Verdict }[]>([]);
  const [tally, setTally] = useState({ seen: 0, caught: 0 });
  const [current, setCurrent] = useState<Flow | null>(null);

  const packets = useRef<Packet[]>([]);
  const packetFlow = useRef<Map<number, Flow>>(new Map());
  const nextKey = useRef(1);
  const cursor = useRef(0);
  const modelRef = useRef(model);
  useEffect(() => { modelRef.current = model; }, [model]);
  const verdictForRef = useRef(verdictFor);
  useEffect(() => { verdictForRef.current = verdictFor; }, [verdictFor]);

  const benignPool = sim.byClass["Benign"] ?? [];
  const attackPool = useMemo(() => {
    const pool = sim.byClass[attackClass] ?? [];
    if (stationState === "idle") {
      const filtered = pool.filter((id) => byId.get(id)?.state === "idle");
      if (filtered.length) return filtered;
    }
    return pool;
  }, [sim.byClass, attackClass, stationState, byId]);

  const reset = useCallback(() => {
    packets.current = [];
    packetFlow.current.clear();
    cursor.current = 0;
    setFeed([]); setTally({ seen: 0, caught: 0 }); setCurrent(null); setTapPulse(null);
  }, []);

  // Emit packets on a cadence. Benign loops while idle; launching swaps the pool.
  useEffect(() => {
    if (!streaming) return;
    const pool = attacking ? attackPool : benignPool;
    if (!pool.length) return;

    const launch = LAUNCH_POINTS.find((l) => l.id === launchPoint)!;
    const id = setInterval(() => {
      if (packets.current.length > 26) return; // keep the wire legible
      const flowId = pool[cursor.current % pool.length];
      cursor.current += 1;
      const flow = byId.get(flowId);
      if (!flow) return;
      const key = nextKey.current++;
      packetFlow.current.set(key, flow);
      packets.current.push({
        key,
        pathD: pathForFlow(flow.evse, flow.state, launch.path, attacking),
        startedAt: performance.now(),
        duration: 0, // filled from real path length on the first frame
        progress: 0,
        tone: groupTone(flow.trueGroup),
        caught: null,
        fired: false,
      });
    }, EMIT_MS[speed]);
    return () => clearInterval(id);
  }, [streaming, attacking, attackPool, benignPool, byId, launchPoint, speed]);

  const handleTap = useCallback((key: number) => {
    const flow = packetFlow.current.get(key);
    if (!flow) return;
    const verdict = verdictForRef.current(flow, modelRef.current);
    if (!verdict) return;

    const packet = packets.current.find((p) => p.key === key);
    if (packet) packet.caught = verdict.correct;

    setTapPulse({ caught: verdict.correct, at: Date.now() });
    setCurrent(flow);
    setFeed((prev) => [{ flow, verdict }, ...prev].slice(0, 40));
    setTally((prev) => ({ seen: prev.seen + 1, caught: prev.caught + (verdict.correct ? 1 : 0) }));
    packetFlow.current.delete(key);
  }, []);

  const rate = tally.seen ? tally.caught / tally.seen : null;
  const isOnline = sim.onlineModels.includes(model);
  const latestArf = feed.find((f) => f.verdict.runningAccuracy !== undefined)?.verdict;
  const selected = selectedNode ? nodeById(selectedNode) : null;

  const launchAttack = () => { reset(); setAttacking(true); setStreaming(true); };
  const stopAttack = () => { reset(); setAttacking(false); setStreaming(true); };

  return (
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
            {GROUP_ORDER.map((g) => {
              const members = attackClasses.filter((c) => sim.groups[c] === g);
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

          <label className="mt-4 block text-[11px] text-slate-500" htmlFor="launch-from">Launch from</label>
          <select
            id="launch-from" value={launchPoint}
            onChange={(e) => setLaunchPoint(e.target.value)}
            className="mt-1.5 w-full rounded-md border border-white/10 bg-[#0B1220] px-2.5 py-2 text-[13px] text-slate-100 focus-visible:outline-2 focus-visible:outline-emerald-400"
          >
            {LAUNCH_POINTS.map((l) => <option key={l.id} value={l.id}>{l.label}</option>)}
          </select>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {LAUNCH_POINTS.find((l) => l.id === launchPoint)?.note}
          </p>

          <button
            onClick={attacking ? stopAttack : launchAttack}
            className={`mt-4 inline-flex w-full items-center justify-center gap-2 rounded-md px-3 py-2.5 text-sm font-medium ring-1 ring-inset transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 ${
              attacking
                ? "bg-rose-500/12 text-rose-300 ring-rose-500/25 hover:bg-rose-500/20"
                : "bg-emerald-500/12 text-emerald-300 ring-emerald-500/25 hover:bg-emerald-500/20"
            }`}
          >
            {attacking ? <><Square className="h-3.5 w-3.5" aria-hidden />Stop attack</>
                       : <><Radio className="h-4 w-4" aria-hidden />Launch attack</>}
          </button>
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
              {attacking ? `${prettyClass(attackClass)} in flight` : "benign heartbeat · looping 12 held-out flows"}
            </span>
          </div>
          <TopologyCanvas
            packets={packets} onTap={handleTap}
            selected={selectedNode} onSelect={setSelectedNode}
            tapPulse={tapPulse} running={streaming}
          />
        </div>

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

        <FlowInspector flow={current} model={model} spec={sim.featureSpec} verdictFor={verdictFor} />
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
                          <span className="text-slate-600"> · {GROUP_TITLE[verdict.group] ?? verdict.group}</span>
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
  const fam = group === "benign"
    ? { dim: "rgba(56,189,248,0.16)", stroke: "#38BDF8" }
    : FAMILY[(group as keyof typeof FAMILY)] ?? FAMILY.other;
  return (
    <span
      className={`inline-block rounded px-1.5 py-0.5 font-medium uppercase tracking-wide ${
        tiny ? "mt-0.5 text-[9px]" : "text-[10px]"
      } ${className}`}
      style={{ background: fam.dim, color: fam.stroke }}
    >
      {GROUP_TITLE[group] ?? group}
    </span>
  );
}

function FlowInspector({
  flow, model, spec, verdictFor,
}: {
  flow: Flow | null; model: string; spec: FeatureSpec[];
  verdictFor: (flow: Flow, name: string) => Verdict | undefined;
}) {
  const verdict = flow ? verdictFor(flow, model) : undefined;
  return (
    <div className="rounded-lg border border-white/8 bg-white/[0.02] p-4">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-[11px] uppercase tracking-[0.14em] text-slate-500">
          Flow inspector — packet at the tap
        </h3>
        {flow && <span className="font-mono text-[10px] tabular-nums text-slate-600">
          flow #{flow.id} · {flow.evse} · {flow.state}
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
