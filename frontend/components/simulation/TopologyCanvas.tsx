"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODES, PATHS, TAP_POINT, type NodeId, type Sender, type TopoNode } from "./topology";
import { FAMILY } from "../dashboard/theme";

export type Packet = {
  key: number;
  pathD: string;
  /** wall-clock ms when the packet entered the wire */
  startedAt: number;
  /** ms to traverse the whole path, set from its real length */
  duration: number;
  /** 0..1 along the path, derived from elapsed time rather than accumulated */
  progress: number;
  tone: string;
  /** set at the tap: did the detector classify this flow correctly */
  caught: boolean | null;
  fired: boolean;
  /** dropped at the switch by a quarantine: never reaches the tap or a station */
  blocked?: boolean;
  /** the station an attack packet was aimed at, flashed when it arrives */
  target: NodeId | null;
  /** fraction of the path where it passes Sentinel, measured on first frame */
  tapAt?: number;
};

/** Wire speed in user units per second. */
export const WIRE_SPEED = 190;

type Props = {
  packets: React.MutableRefObject<Packet[]>;
  onTap: (key: number) => void;
  selected: NodeId | null;
  onSelect: (id: NodeId | null) => void;
  /** flagged = the detector raised an alert (called it anything but Benign) */
  tapPulse: { flagged: boolean; at: number } | null;
  running: boolean;
  /** the device sending the current attack, from the recording */
  sender: Sender | null;
  /** devices an operator has quarantined (simulated switch ACL) */
  quarantined?: string[];
};

const NODE_TONE: Record<TopoNode["kind"], string> = {
  csms: "#38BDF8",
  evse: "#22C55E",
  vehicle: "#A78BFA",
  attacker: "#F43F5E",
  sentinel: "#22C55E",
};

/**
 * The testbed, drawn to scale, with packets travelling the links they actually
 * crossed. Motion is driven by requestAnimationFrame against real path geometry
 * so a verdict fires at the exact moment a packet reaches the tap, rather than
 * on a timer that merely looks synchronised.
 */
export default function TopologyCanvas({
  packets, onTap, selected, onSelect, tapPulse, running, sender, quarantined = [],
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const measureRef = useRef<SVGPathElement | null>(null);
  const frame = useRef<number>(0);
  // Everything the SVG draws is snapshotted once per frame inside the loop, so
  // render itself reads no refs and no clocks.
  const [snap, setSnap] = useState<{
    now: number; wall: number;
    dots: { key: number; x: number; y: number; progress: number; tone: string; caught: boolean | null; blocked?: boolean }[];
    hits: Partial<Record<NodeId, number>>;
  }>({ now: 0, wall: 0, dots: [], hits: {} });

  // Path length is geometry, not state; cache it per path string.
  const lengths = useRef<Map<string, number>>(new Map());
  const lengthOf = useCallback((d: string) => {
    const cached = lengths.current.get(d);
    if (cached !== undefined) return cached;
    const probe = measureRef.current;
    if (!probe) return 0;
    probe.setAttribute("d", d);
    const total = probe.getTotalLength();
    lengths.current.set(d, total);
    return total;
  }, []);

  // Where each path passes Sentinel: the sampled point nearest the tap.
  const taps = useRef<Map<string, number>>(new Map());
  const tapOf = useCallback((d: string) => {
    const cached = taps.current.get(d);
    if (cached !== undefined) return cached;
    const probe = measureRef.current;
    if (!probe) return 0.5;
    probe.setAttribute("d", d);
    const total = probe.getTotalLength();
    let best = 0.5, bestDist = Infinity;
    for (let i = 0; i <= 120; i++) {
      const q = probe.getPointAtLength((i / 120) * total);
      const dist = Math.hypot(q.x - TAP_POINT.x, q.y - TAP_POINT.y);
      if (dist < bestDist) { bestDist = dist; best = i / 120; }
    }
    taps.current.set(d, best);
    return best;
  }, []);
  // When each station was last hit, for the arrival flash.
  const hits = useRef<Partial<Record<NodeId, number>>>({});

  const pointAt = useCallback((d: string, t: number) => {
    const probe = measureRef.current;
    if (!probe) return { x: 0, y: 0 };
    probe.setAttribute("d", d);
    const p = probe.getPointAtLength(Math.max(0, Math.min(1, t)) * probe.getTotalLength());
    return { x: p.x, y: p.y };
  }, []);

  useEffect(() => {
    // Progress is derived from elapsed wall-clock time, not accumulated per
    // frame. Accumulating loses progress whenever frames are starved -- a
    // backgrounded tab, a slow device -- and a packet could sail past the tap
    // between two frames without ever tripping the verdict. Deriving it means
    // the first frame after any gap sees the true position, and the tap still
    // fires exactly once, on the frame that observes the crossing.
    const tick = () => {
      const now = performance.now();
      const list = packets.current;
      for (let i = list.length - 1; i >= 0; i--) {
        const p = list[i];
        if (!p.duration) {
          const total = lengthOf(p.pathD) || 320;
          p.duration = (total / WIRE_SPEED) * 1000;
        }
        if (p.tapAt === undefined) p.tapAt = tapOf(p.pathD);
        p.progress = (now - p.startedAt) / p.duration;
        if (!p.fired && !p.blocked && p.progress >= p.tapAt) {
          p.fired = true;
          onTap(p.key);
        }
        if (p.progress >= 1) {
          if (p.target && !p.blocked) hits.current[p.target] = now;
          list.splice(i, 1);
        }
      }
      setSnap({
        now,
        wall: Date.now(),
        dots: list.map((p) => {
          const pt = pointAt(p.pathD, p.progress);
          return { key: p.key, x: pt.x, y: pt.y, progress: p.progress, tone: p.tone, caught: p.caught, blocked: p.blocked };
        }),
        hits: { ...hits.current },
      });
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [packets, onTap, lengthOf, tapOf, pointAt]);

  const pulseAge = tapPulse ? snap.wall - tapPulse.at : Infinity;
  const pulsing = pulseAge < 420;

  const links = useMemo(
    () => [
      { d: PATHS.uplink, label: "internet" },
      { d: "M320,170 L320,210", label: "" },
      { d: "M320,266 L320,328", label: "OCPP · wifi" },
      { d: "M134,328 L134,292 Q134,238 240,238 L320,238", label: "" },
      { d: "M394,356 L434,356", label: "V2G · eth0" },
    ],
    [],
  );

  return (
    <svg
      ref={svgRef}
      viewBox="0 0 640 420"
      className="w-full"
      role="img"
      aria-label="CICEVSE2024 testbed topology. Attacks travel from the attacker or a compromised car to the charging station they target; EVNet Sentinel watches a mirrored copy of the switch traffic."
    >
      <defs>
        <filter id="tapGlow" x="-60%" y="-60%" width="220%" height="220%">
          <feGaussianBlur stdDeviation="7" result="b" />
          <feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      {/* hidden probe used only for path measurement */}
      <path ref={measureRef} d="" fill="none" stroke="none" />

      {links.map((l, i) => (
        <path key={i} d={l.d} fill="none" stroke="rgba(148,163,184,0.28)" strokeWidth="1.5" />
      ))}
      {/* attack routes stay dashed: they are not part of the legitimate network */}
      {(["attacker->evse-a", "attacker->evse-b", "evcc->evse-b"] as const).map((k) => (
        <path key={k} d={PATHS[k]} fill="none" strokeWidth="1.5" strokeDasharray="5 4"
          stroke={k === "evcc->evse-b" ? (sender === "evcc" ? "rgba(244,63,94,0.55)" : "rgba(244,63,94,0.16)") : "rgba(244,63,94,0.4)"} />
      ))}

      <text x="330" y="96" fill="rgba(148,163,184,0.75)" fontSize="9" fontFamily="ui-monospace, monospace">internet</text>
      <text x="330" y="302" fill="rgba(148,163,184,0.75)" fontSize="9" fontFamily="ui-monospace, monospace">OCPP · wifi</text>
      <text x="398" y="350" fill="rgba(148,163,184,0.75)" fontSize="9" fontFamily="ui-monospace, monospace">V2G</text>

      {NODES.map((n) => {
        const tone = NODE_TONE[n.kind];
        const isSentinel = n.kind === "sentinel";
        const isSelected = selected === n.id;
        const hitAge = snap.hits[n.id] ? snap.now - snap.hits[n.id]! : Infinity;
        const compromised = n.id === "evcc" && sender === "evcc";
        const blockedNode = (n.id === "attacker" && quarantined.some((q) => q === "kali" || q === "rpi"))
          || (n.id === "evcc" && quarantined.includes("evcc"));
        return (
          <g
            key={n.id}
            onClick={() => onSelect(isSelected ? null : n.id)}
            className="cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`${n.name} — ${n.role}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onSelect(isSelected ? null : n.id); }
            }}
          >
            <rect
              x={n.x} y={n.y} width={n.w} height={n.h} rx="4"
              fill={isSentinel ? "rgba(34,197,94,0.13)" : "rgba(255,255,255,0.028)"}
              stroke={blockedNode ? "#94A3B8" : compromised ? "#F43F5E" : isSelected ? tone : isSentinel ? tone : "rgba(255,255,255,0.16)"}
              strokeWidth={isSentinel ? 2 : isSelected || compromised ? 1.8 : 1}
              strokeDasharray={n.kind === "attacker" || compromised ? "5 4" : undefined}
              filter={isSentinel && pulsing ? "url(#tapGlow)" : undefined}
            />
            {isSentinel && pulsing && (
              <>
                <rect
                  x={n.x} y={n.y} width={n.w} height={n.h} rx="4" fill="none" strokeWidth="2.5"
                  stroke={tapPulse!.flagged ? "#F43F5E" : "#22C55E"}
                  opacity={Math.max(0, 1 - pulseAge / 420)}
                />
                {tapPulse!.flagged && (
                  <text x={n.x + n.w - 6} y={n.y - 6} textAnchor="end" fontSize="9" fontWeight={700}
                    fill="#FDA4AF" opacity={Math.max(0, 1 - pulseAge / 420)} fontFamily="ui-monospace, monospace">
                    ALERT
                  </text>
                )}
              </>
            )}
            {blockedNode && (
              <text x={n.x + n.w - 6} y={n.y - 6} textAnchor="end" fontSize="9" fontWeight={700}
                fill="#CBD5E1" fontFamily="ui-monospace, monospace">QUARANTINED</text>
            )}
            {hitAge < 520 && (
              <rect x={n.x - 4} y={n.y - 4} width={n.w + 8} height={n.h + 8} rx="6" fill="rgba(244,63,94,0.08)"
                stroke="#F43F5E" strokeWidth="2" opacity={Math.max(0, 1 - hitAge / 520)} />
            )}
            <text x={n.x + n.w / 2} y={n.y + 23} textAnchor="middle" fontSize="12"
              fill={isSentinel ? tone : "#E2E8F0"} fontWeight={isSentinel ? 600 : 500}
              fontFamily="ui-sans-serif, system-ui">
              {n.name}
            </text>
            <text x={n.x + n.w / 2} y={n.y + 39} textAnchor="middle" fontSize="9"
              fill="rgba(148,163,184,0.9)" fontFamily="ui-monospace, monospace">
              {n.kind === "sentinel" ? "mirror-port tap"
                : n.kind === "attacker" ? (sender === "rpi" ? "Raspberry Pi · wifi" : "Kali Linux PC · wifi")
                : compromised ? "compromised · eth0" : n.iface}
            </text>
          </g>
        );
      })}

      {snap.dots.map((p) => (
        <circle
          key={p.key} cx={p.x} cy={p.y}
          r={p.caught === null ? 3.6 : 4.4}
          fill={p.blocked ? "#64748B" : p.caught === null ? p.tone : p.caught ? "#22C55E" : "#F59E0B"}
          opacity={p.progress > 0.94 ? Math.max(0, (1 - p.progress) / 0.06) : 1}
        />
      ))}

      {!running && snap.dots.length === 0 && (
        <text x="320" y="404" textAnchor="middle" fontSize="10"
          fill="rgba(148,163,184,0.65)" fontFamily="ui-monospace, monospace">
          idle — no traffic on the wire
        </text>
      )}
    </svg>
  );
}

export const groupTone = (group: string) =>
  group === "volumetric" ? FAMILY.volumetric.stroke
  : group === "recon" ? FAMILY.recon.stroke
  : group === "benign" ? "#38BDF8"
  : FAMILY.other.stroke;
