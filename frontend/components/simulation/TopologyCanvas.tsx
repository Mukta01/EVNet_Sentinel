"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { NODES, PATHS, TAP_AT, type NodeId, type TopoNode } from "./topology";
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
  caught: boolean | null;
  fired: boolean;
};

/** Wire speed in user units per second. */
export const WIRE_SPEED = 190;

type Props = {
  packets: React.MutableRefObject<Packet[]>;
  onTap: (key: number) => void;
  selected: NodeId | null;
  onSelect: (id: NodeId | null) => void;
  tapPulse: { caught: boolean; at: number } | null;
  running: boolean;
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
  packets, onTap, selected, onSelect, tapPulse, running,
}: Props) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const measureRef = useRef<SVGPathElement | null>(null);
  const frame = useRef<number>(0);
  const [, forceRender] = useState(0);

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
        p.progress = (now - p.startedAt) / p.duration;
        if (!p.fired && p.progress >= TAP_AT) {
          p.fired = true;
          onTap(p.key);
        }
        if (p.progress >= 1) list.splice(i, 1);
      }
      forceRender((n) => (n + 1) % 1000000);
      frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [packets, onTap, lengthOf]);

  const rendered = packets.current.map((p) => ({ p, pt: pointAt(p.pathD, p.progress) }));
  const pulseAge = tapPulse ? Date.now() - tapPulse.at : Infinity;
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
      aria-label="CICEVSE2024 testbed topology with EVNet Sentinel tapped inline between the charging stations and the CSMS."
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
      {/* attacker route stays dashed: it is not part of the legitimate network */}
      <path d={PATHS.attacker} fill="none" stroke="rgba(244,63,94,0.4)" strokeWidth="1.5" strokeDasharray="5 4" />

      <text x="330" y="96" fill="rgba(148,163,184,0.75)" fontSize="9" fontFamily="ui-monospace, monospace">internet</text>
      <text x="330" y="302" fill="rgba(148,163,184,0.75)" fontSize="9" fontFamily="ui-monospace, monospace">OCPP · wifi</text>
      <text x="398" y="350" fill="rgba(148,163,184,0.75)" fontSize="9" fontFamily="ui-monospace, monospace">V2G</text>

      {NODES.map((n) => {
        const tone = NODE_TONE[n.kind];
        const isSentinel = n.kind === "sentinel";
        const isSelected = selected === n.id;
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
              stroke={isSelected ? tone : isSentinel ? tone : "rgba(255,255,255,0.16)"}
              strokeWidth={isSentinel ? 2 : isSelected ? 1.8 : 1}
              strokeDasharray={n.kind === "attacker" ? "5 4" : undefined}
              filter={isSentinel && pulsing ? "url(#tapGlow)" : undefined}
            />
            {isSentinel && pulsing && (
              <rect
                x={n.x} y={n.y} width={n.w} height={n.h} rx="4" fill="none" strokeWidth="2.5"
                stroke={tapPulse!.caught ? "#22C55E" : "#F43F5E"}
                opacity={Math.max(0, 1 - pulseAge / 420)}
              />
            )}
            <text x={n.x + n.w / 2} y={n.y + 23} textAnchor="middle" fontSize="12"
              fill={isSentinel ? tone : "#E2E8F0"} fontWeight={isSentinel ? 600 : 500}
              fontFamily="ui-sans-serif, system-ui">
              {n.name}
            </text>
            <text x={n.x + n.w / 2} y={n.y + 39} textAnchor="middle" fontSize="9"
              fill="rgba(148,163,184,0.9)" fontFamily="ui-monospace, monospace">
              {n.kind === "sentinel" ? "inline tap" : n.iface}
            </text>
          </g>
        );
      })}

      {rendered.map(({ p, pt }) => (
        <circle
          key={p.key} cx={pt.x} cy={pt.y}
          r={p.caught === null ? 3.6 : 4.4}
          fill={p.caught === null ? p.tone : p.caught ? "#22C55E" : "#F43F5E"}
          opacity={p.progress > 0.94 ? Math.max(0, (1 - p.progress) / 0.06) : 1}
        />
      ))}

      {!running && packets.current.length === 0 && (
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
