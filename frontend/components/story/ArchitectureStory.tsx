"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useReducedMotion } from "framer-motion";
import { HUBS, MAP_BOUNDS, WARDS } from "./mumbai";
import "./ArchitectureStory.css";

gsap.registerPlugin(ScrollTrigger);

/**
 * How it works, told as one pinned scene the reader scrolls through.
 *
 * The camera starts on a real map of Mumbai, drops into one charging hub,
 * lets an attacker onto the wire, puts Sentinel in the way, opens Sentinel up,
 * and ends with who acts and what we measured. ScrollTrigger pins the stage and
 * scrubs a single progress value; everything on screen is a function of it,
 * so scrolling back plays the story backwards.
 */

type Chapter = { k: string; title: string; body: string; fact: string };

const CHAPTERS: Chapter[] = [
  { k: "The real world", title: "Every charger in Mumbai phones home.",
    body: "Public chargers across the city — malls, offices, car parks — are networked computers. Each one reports to a charging management system (CSMS) in the cloud.",
    fact: "That link carries <b>authorisation, billing and remote control</b>. If it stops, drivers can’t charge." },
  { k: "One charging hub", title: "A car plugs in. The station reports home.",
    body: "The car talks to the station over ISO 15118. The station talks to the CSMS over OCPP — heartbeats, meter values, session starts — usually across the site’s shared wifi.",
    fact: "This is the setup behind <b>CICEVSE2024</b>: two stations, a CSMS, and recorded attack traffic." },
  { k: "The threat", title: "The charging station is the target.",
    body: "Anyone on the site wifi can reach the station itself. First they scan it — ports, services, firmware. Then they flood it until it can’t keep up its link to the CSMS. Even the car can be the attacker, scanning through the charging cable.",
    fact: "In CICEVSE2024 <b>every attack targets a charging station</b>: 51 captures from a PC or Raspberry Pi on the wifi, 6 from a compromised car." },
  { k: "The defence", title: "Sentinel watches a copy of every packet.",
    body: "The site’s switch mirrors all traffic to Sentinel. It never sits in the way: it classifies each flow and raises an alert naming the attack and the station it hit — so people can act.",
    fact: "This is exactly how the dataset was recorded: <b>from a mirrored switch port</b>. An IDS detects; it does not block." },
  { k: "Inside Sentinel", title: "From packets to a verdict.",
    body: "Packets become one flow of 60 statistics. Columns that only identify the recording are stripped. Four static models and an online learner judge it.",
    fact: "Removing those columns is our core correction: the published <b>98%</b> came from a single timestamp column." },
  { k: "The response", title: "An alert is only useful if someone knows what to do.",
    body: "Every detection maps to concrete steps for three people: the station owner, the CSMS operator and the network analyst.",
    fact: "When a model can’t reliably name an attack, it says so and gives <b>category-level</b> advice instead." },
  { k: "What we measured", title: "Honest numbers, tested per attack.",
    body: "Every attack type, fed to every model, in random batches across three independently trained model sets.",
    fact: "No attack slipped through as normal traffic: <b>≥ 99.9%</b> flagged in every mixed campaign." },
];
const N = CHAPTERS.length;

const FOCUS = HUBS.findIndex((h) => h.name === "BKC");
const CSMS_AT = { x: 1420, y: 150 };
/** The hub close-up is drawn in its own frame, placed right of the narrative. */
const HUB_FRAME = "translate(100 30) scale(0.98)";
/** Sentinel hangs off the switch's mirror port, out of the traffic's way. */
const SENTINEL_AT = { x: 700, y: 380 };

/** How far into each chapter its narration appears: the scene builds first, then the words. */
const TEXT_AT = [0, 0.62, 0.3, 0.3, 0, 0, 0];
/** Car start offset: it drives in from off-screen left. */
const CAR_FROM = -620;

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);
const seg = (p: number, a: number, b: number) => ease(clamp((p - a) / (b - a)));

export default function ArchitectureStory() {
  const reduceMotion = useReducedMotion();
  if (reduceMotion) return <StaticStory />;
  return <PinnedStory />;
}

function PinnedStory() {
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const [chapter, setChapter] = useState(0);
  const [textOn, setTextOn] = useState(true);
  const textRef = useRef(true);
  const chapterRef = useRef(0);
  const trigger = useRef<ScrollTrigger | null>(null);
  // What the packet loop needs to know about the current frame.
  const scene = useRef({ hubOn: 0, attack: 0, sentinel: 0, wires: 0, plugged: 0, evil: 0 });

  const q = (sel: string) => stage.current?.querySelector(sel) as SVGElement | HTMLElement | null;
  const qa = (sel: string) => Array.from(stage.current?.querySelectorAll<HTMLElement>(sel) ?? []);

  const render = (p: number) => {
    const ch = Math.min(N - 1, Math.floor(p * N));
    const local = p * N - ch;
    if (ch !== chapterRef.current) {
      chapterRef.current = ch;
      setChapter(ch);
    }
    const showText = local >= TEXT_AT[ch];
    if (showText !== textRef.current) {
      textRef.current = showText;
      setTextOn(showText);
    }

    // 2: the hub assembles in order — CSMS, wifi, link, station, link, car, cable
    const b = clamp((p - 1 / N) * N);
    const show = (sel: string, v: number, dy = 14) => {
      const e = q(sel);
      if (!e) return;
      e.setAttribute("opacity", String(v));
      e.style.transform = `translateY(${(1 - v) * dy}px)`;
    };
    const draw = (sel: string, v: number) => q(sel)?.setAttribute("stroke-dashoffset", String(1 - v));
    show("#as-csms-node", seg(b, 0, 0.08));
    show("#as-wifi", seg(b, 0.07, 0.15));
    draw("#as-wire2", seg(b, 0.12, 0.22));
    show("#as-ocpp-label", seg(b, 0.18, 0.24), 0);
    show("#as-evse", seg(b, 0.2, 0.28));
    draw("#as-wire1", seg(b, 0.26, 0.34));
    const drive = seg(b, 0.34, 0.58);
    const car = q("#as-car");
    car?.setAttribute("transform", `translate(${300 + (1 - drive) * CAR_FROM} 690)`);
    car?.setAttribute("opacity", String(clamp(drive * 4)));
    qa(".as-wheel").forEach((w) => w.setAttribute("transform", `rotate(${-(1 - drive) * CAR_FROM * 0.9})`));
    show("#as-carpark", seg(b, 0.3, 0.4), 0);
    draw("#as-cable", seg(b, 0.6, 0.68));
    show("#as-iso-label", seg(b, 0.64, 0.7), 0);
    const plugged = seg(b, 0.68, 0.74);
    show("#as-charge", plugged, 10);

    const bar = q(".progress i") as HTMLElement | null;
    if (bar) bar.style.width = `${p * 100}%`;

    // 1 → 2: zoom from the city map into the BKC hub
    const hub = HUBS[FOCUS];
    const zoom = seg(p, 0.095, 0.16);
    const s = 1 + zoom * 7;
    const city = q("#as-city");
    city?.setAttribute("transform",
      `translate(800 450) scale(${s}) translate(${-(800 + (hub.x - 800) * zoom)} ${-(450 + (hub.y - 450) * zoom)})`);
    city?.setAttribute("opacity", String(1 - seg(p, 0.12, 0.16)));

    const hubIn = seg(p, 0.13, 0.19);
    const hubOut = seg(p, 4 / N + 0.02, 4 / N + 0.08);
    const hubEl = q("#as-hub");
    hubEl?.setAttribute("opacity", String(hubIn * (1 - hubOut * 0.95)));
    const hs = 0.55 + 0.45 * hubIn + hubOut * 0.6;
    hubEl?.setAttribute("transform",
      `translate(${SENTINEL_AT.x} ${SENTINEL_AT.y}) scale(${hs}) translate(${-SENTINEL_AT.x} ${-SENTINEL_AT.y})`);

    const attack = seg(p, 2 / N + 0.01, 2 / N + 0.05);
    q("#as-attacker")?.setAttribute("opacity", String(attack));
    q("#as-wireA")?.setAttribute("stroke-opacity", String(attack * 0.8));
    // Halfway through the threat chapter the car itself turns attacker.
    const evil = seg(p, 2 / N + 0.5 / N, 2 / N + 0.56 / N);
    q("#as-car-evil")?.setAttribute("opacity", String(evil));
    qa(".as-mirror").forEach((e) => e.setAttribute("opacity", String(seg(p, 3 / N + 0.01, 3 / N + 0.05))));
    const sentinel = seg(p, 3 / N + 0.01, 3 / N + 0.05);
    const sent = q("#as-sentinel");
    sent?.setAttribute("opacity", String(sentinel));
    sent?.setAttribute("transform", `translate(${SENTINEL_AT.x} ${SENTINEL_AT.y - (1 - sentinel) * 60})`);
    scene.current = {
      hubOn: hubIn > 0.5 && hubOut < 0.5 ? 1 : 0, attack, sentinel,
      wires: b > 0.34 ? 1 : 0, plugged: plugged > 0.5 ? 1 : 0, evil: evil > 0.5 ? 1 : 0,
    };

    // chapters 5–7: html overlays, stepped by progress within the chapter
    q("#as-pipe")?.classList.toggle("on", ch === 4);
    qa(".step").forEach((e, i) => e.classList.toggle("on", ch > 4 || (ch === 4 && local > i * 0.17)));
    qa(".cutme").forEach((e) => e.classList.toggle("cut", ch > 4 || (ch === 4 && local > 0.5)));
    q("#as-resp")?.classList.toggle("on", ch === 5);
    qa(".role").forEach((e, i) => e.classList.toggle("on", ch > 5 || (ch === 5 && local > 0.12 + i * 0.18)));
    q("#as-res")?.classList.toggle("on", ch === 6);
    qa("[data-count]").forEach((e) => {
      const target = Number(e.dataset.count);
      e.textContent = `${Math.round(target * (ch === 6 ? seg(local, 0.05, 0.45) : ch > 6 ? 1 : 0))}%`;
    });
  };

  useGSAP(
    () => {
      const proxy = { p: 0 };
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: section.current,
          start: "top top",
          // About 1.15 screen-heights of scroll per chapter.
          end: () => `+=${N * 1.15 * window.innerHeight}`,
          invalidateOnRefresh: true,
          pin: stage.current,
          scrub: 0.6,
          anticipatePin: 1,
        },
      });
      tl.to(proxy, { p: 1, ease: "none", duration: 1, onUpdate: () => render(proxy.p) });
      trigger.current = tl.scrollTrigger ?? null;
      render(0);
    },
    { scope: section },
  );

  // Narrow screens: crop to the scene and anchor it to the bottom.
  useEffect(() => {
    const svg = q("svg.scene");
    const mq = window.matchMedia("(max-width: 1000px)");
    const apply = () => {
      svg?.setAttribute("viewBox", mq.matches ? "200 90 1380 760" : "0 0 1600 900");
      svg?.setAttribute("preserveAspectRatio", mq.matches ? "xMidYMax meet" : "xMidYMid meet");
    };
    apply();
    mq.addEventListener("change", apply);
    return () => mq.removeEventListener("change", apply);
  }, []);

  // Packets and the CSMS heartbeat run on their own clock, independent of scroll.
  useEffect(() => {
    const layer = q("#as-packets") as SVGGElement | null;
    const paths = {
      cable: q("#as-cable") as SVGPathElement,
      w1: q("#as-wire1") as SVGPathElement,
      w1r: q("#as-wire1r") as SVGPathElement,
      w2: q("#as-wire2") as SVGPathElement,
      wa: q("#as-wireA") as SVGPathElement,
      mirror: q("#as-mirror-path") as SVGPathElement,
      mirrorV2g: q("#as-mirror-v2g") as SVGPathElement,
    };
    const hb = q("#as-hb");
    const status = q("#as-csms-status");
    const note = q("#as-csms-note");
    const glow = q("#as-sent-glow");
    const battery = q("#as-battery");
    const screen = q("#as-evse-screen");
    const body = q("#as-evse-body");
    const alert = q("#as-alert");
    let charge = 0.18;
    if (!layer || !hb || !status) return;

    type Route = (keyof typeof paths)[];
    type Pk = { route: Route; i: number; t: number; c: SVGCircleElement; kind: "ok" | "wifi" | "car" | "copy"; dead: boolean };
    const packets: Pk[] = [];
    let last = 0, phase = 0, down = 0, raf = 0, hitAt = -1e9, alertAt = -1e9;
    let alertText = "";

    const spawn = (route: Route, color: string, kind: Pk["kind"]) => {
      const c = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      c.setAttribute("r", kind === "ok" ? "4" : kind === "copy" ? "3" : "5");
      c.setAttribute("fill", color);
      if (kind === "copy") c.setAttribute("fill-opacity", "0.7");
      layer.appendChild(c);
      packets.push({ route, i: 0, t: 0, c, kind, dead: false });
    };

    const tick = (now: number) => {
      const { hubOn, attack, sentinel, wires, plugged, evil } = scene.current;
      if (battery) {
        charge = plugged ? Math.min(1, charge + 0.0025) : 0.18;
        battery.setAttribute("width", String(120 * charge));
      }
      glow?.setAttribute("r", String(90 + 25 * Math.sin(now / 500)));

      // A flooded station can't keep its OCPP link up. Sentinel observes, it
      // doesn't block, so its arrival doesn't restore the link.
      down += ((attack > 0.5 ? 1 : 0) - down) * 0.03;
      phase += 0.04;
      const pts: string[] = [];
      for (let x = 0; x <= 150; x += 5) {
        const beat = (Math.sin((x / 150) * Math.PI * 4 - phase * 3) > 0.92 ? -16 : 0) * (1 - down);
        pts.push(`${x - 75},${14 + beat}`);
      }
      hb.setAttribute("points", pts.join(" "));
      hb.setAttribute("stroke", down > 0.5 ? "#F43F5E" : "#22C55E");
      const online = Math.round(12 - down * 9);
      status.textContent = `${online} / 12 stations online`;
      status.setAttribute("fill", online < 12 ? "#FDA4AF" : "#86EFAC");
      note?.setAttribute("opacity", String(down));

      // The targeted station reacts when attack traffic lands on it.
      const hit = now - hitAt < 450;
      if (screen) {
        screen.textContent = hit ? "⚠ ATTACK" : plugged ? "⚡ 7.4kW" : "READY";
        screen.setAttribute("fill", hit ? "#FDA4AF" : "#86EFAC");
      }
      body?.setAttribute("stroke", hit ? "#F43F5E" : "#22C55E");
      if (alert) {
        const age = now - alertAt;
        alert.textContent = alertText;
        alert.setAttribute("opacity", String(sentinel > 0.5 ? Math.max(0, 1 - age / 1600) : 0));
      }

      if (hubOn && wires && now - last > 260) {
        last = now;
        spawn(plugged ? ["cable", "w1", "w2"] : ["w1", "w2"], "#38BDF8", "ok");
        if (attack > 0.5 && Math.random() < 0.7) spawn(["wa", "w1r"], "#F43F5E", "wifi");
        if (evil && plugged && Math.random() < 0.35) spawn(["cable"], "#FB7185", "car");
      }
      for (const k of packets) {
        k.t += (k.kind === "ok" ? 0.008 : k.kind === "copy" ? 0.02 : 0.011) * (k.route[k.i] === "w2" ? 0.8 : 1.3);
        if (k.t >= 1) {
          const finished = k.route[k.i];
          // Everything crossing the switch is mirrored to Sentinel.
          if (sentinel > 0.5 && k.kind !== "copy") {
            if (k.kind === "wifi" && finished === "wa") spawn(["mirror"], "#F43F5E", "copy");
            if (k.kind === "ok" && finished === "w1" && Math.random() < 0.3) spawn(["mirror"], "#38BDF8", "copy");
            if (k.kind === "car" && finished === "cable") spawn(["mirrorV2g"], "#FB7185", "copy");
          }
          k.i += 1; k.t = 0;
          if (k.i >= k.route.length) {
            k.dead = true;
            if (k.kind === "wifi" || k.kind === "car") hitAt = now;
            if (k.kind === "copy" && k.c.getAttribute("fill") !== "#38BDF8") {
              alertAt = now;
              alertText = finished === "mirrorV2g" ? "⚠ ALERT · port scan from the car" : "⚠ ALERT · SYN Flood → station";
            }
            continue;
          }
        }
        const cur = paths[k.route[k.i]];
        const pt = cur.getPointAtLength(k.t * cur.getTotalLength());
        k.c.setAttribute("cx", String(pt.x));
        k.c.setAttribute("cy", String(pt.y));
      }
      for (let i = packets.length - 1; i >= 0; i--) {
        if (packets[i].dead) { packets[i].c.remove(); packets.splice(i, 1); }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); packets.forEach((k) => k.c.remove()); };
  }, []);

  const jumpTo = (i: number) => {
    const st = trigger.current;
    if (!st) return;
    window.scrollTo({ top: st.start + ((i + 0.35) / N) * (st.end - st.start), behavior: "smooth" });
  };

  return (
    <section ref={section} id="architecture" className="arch-story" aria-label="How EVNet Sentinel works">
      <div ref={stage} className="stage">
        <svg className="scene" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid meet" aria-hidden="true">
          <defs>
            <radialGradient id="as-glow" r="50%"><stop offset="0" stopColor="#22C55E" stopOpacity=".55" /><stop offset="1" stopColor="#22C55E" stopOpacity="0" /></radialGradient>
            <radialGradient id="as-glowR" r="50%"><stop offset="0" stopColor="#F43F5E" stopOpacity=".5" /><stop offset="1" stopColor="#F43F5E" stopOpacity="0" /></radialGradient>
            <pattern id="as-grid" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M40 0H0V40" fill="none" stroke="rgba(148,163,184,0.05)" /></pattern>
          </defs>

          {/* ── 1: Mumbai ───────────────────────────── */}
          <g id="as-city">
            <rect x="-800" y="-600" width="3200" height="2100" fill="url(#as-grid)" />
            <text x="610" y="560" fill="#1E3A5F" fontSize="22" fontStyle="italic" letterSpacing="6">ARABIAN SEA</text>
            <g>
              {WARDS.map((w) => (
                <path key={w.name} d={w.d} fill="rgba(20,83,45,0.22)" stroke="rgba(34,197,94,0.28)" strokeWidth="0.8" />
              ))}
            </g>
            <text x={MAP_BOUNDS.x + MAP_BOUNDS.width - 20} y={MAP_BOUNDS.y + 30} fill="#E2E8F0" fontSize="20" fontWeight="700" letterSpacing="8" textAnchor="end">MUMBAI</text>
            <g fill="none" stroke="#22C55E" strokeOpacity=".28" strokeDasharray="4 7">
              {HUBS.map((h) => (
                <path key={h.name} d={`M${h.x} ${h.y} Q ${(h.x + CSMS_AT.x) / 2} ${Math.min(h.y, CSMS_AT.y) - 40} ${CSMS_AT.x} ${CSMS_AT.y + 30}`} />
              ))}
            </g>
            <g transform={`translate(${CSMS_AT.x} ${CSMS_AT.y})`}>
              <circle r="90" fill="url(#as-glow)" />
              <rect x="-70" y="-30" width="140" height="60" rx="12" fill="#0B1220" stroke="#22C55E" strokeOpacity=".5" />
              <text y="-2" textAnchor="middle" fill="#F8FAFC" fontSize="15" fontWeight="600">CSMS</text>
              <text y="17" textAnchor="middle" fill="#94A3B8" fontSize="11">charging management · cloud</text>
            </g>
            {HUBS.map((h, i) => (
              <g key={h.name} transform={`translate(${h.x} ${h.y})`}>
                <circle r="20" fill="url(#as-glow)" />
                <circle r={i === FOCUS ? 6 : 4.5} fill={i === FOCUS ? "#22C55E" : "#86EFAC"} />
                {i === FOCUS && <circle r="13" fill="none" stroke="#22C55E" strokeOpacity=".7" />}
                <text x={i === FOCUS ? 18 : 9} y="4" fill={i === FOCUS ? "#F8FAFC" : "#94A3B8"}
                      fontSize={i === FOCUS ? 13 : 10.5} fontWeight={i === FOCUS ? 600 : 400}>
                  {i === FOCUS ? "Bandra-Kurla Complex" : h.name}
                </text>
              </g>
            ))}
            <text x={MAP_BOUNDS.x + MAP_BOUNDS.width} y={MAP_BOUNDS.y + MAP_BOUNDS.height + 26} fill="#475569" fontSize="10" textAnchor="end">
              Hub locations illustrative · Ward boundaries: DataMeet, CC BY 4.0
            </text>
          </g>

          {/* ── 2–4: one hub, close up ──────────────── */}
          <g transform={HUB_FRAME}>
            <g id="as-hub" opacity="0">
              <g id="as-carpark" opacity="0">
                <rect x="-60" y="610" width="940" height="170" rx="18" fill="rgba(148,163,184,0.04)" stroke="rgba(148,163,184,0.12)" />
                <path d="M-40 760 H860" stroke="rgba(148,163,184,0.18)" strokeDasharray="18 14" strokeWidth="2" />
                <text x="-40" y="640" fill="#64748B" fontSize="12" className="mono">BKC · PUBLIC CHARGING HUB</text>
              </g>

              <g id="as-car" opacity="0" transform={`translate(${300 + CAR_FROM} 690)`}>
                <rect x="-110" y="-30" width="220" height="56" rx="22" fill="#0F172A" stroke="#38BDF8" strokeOpacity=".7" />
                <path d="M-70 -30 L-40 -62 H40 L70 -30" fill="#0F172A" stroke="#38BDF8" strokeOpacity=".7" />
                <path d="M-34 -56 H-4 V-32 H-58 Z M6 -56 H36 L58 -32 H6 Z" fill="rgba(56,189,248,0.12)" />
                <rect x="-60" y="-8" width="120" height="8" rx="4" fill="rgba(255,255,255,0.06)" />
                <rect id="as-battery" x="-60" y="-8" width="22" height="8" rx="4" fill="#22C55E" />
                <text y="18" textAnchor="middle" fill="#BAE6FD" fontSize="11" fontWeight="600">EV</text>
                <circle cx="104" cy="-8" r="4" fill="#FDE68A" opacity=".9" />
                {[-62, 62].map((cx) => (
                  <g key={cx} transform={`translate(${cx} 28)`}>
                    <g className="as-wheel">
                      <circle r="16" fill="#020617" stroke="#64748B" strokeWidth="2" />
                      <path d="M-11 0 H11 M0 -11 V11" stroke="#475569" strokeWidth="2" />
                    </g>
                  </g>
                ))}
                <g id="as-car-evil" opacity="0">
                  <rect x="-122" y="-74" width="244" height="120" rx="26" fill="none" stroke="#F43F5E" strokeWidth="2" strokeDasharray="6 5" />
                  <text x="0" y="66" textAnchor="middle" fill="#FDA4AF" fontSize="12" fontWeight="600">compromised car · scanning the station</text>
                </g>
                <g id="as-charge" opacity="0">
                  <circle cx="0" cy="-92" r="20" fill="rgba(34,197,94,0.16)" stroke="#22C55E" className="as-charge-ring" />
                  <text x="0" y="-85" textAnchor="middle" fontSize="20">⚡</text>
                  <text x="30" y="-87" fill="#86EFAC" fontSize="12" className="mono">charging</text>
                </g>
              </g>

              <g id="as-evse" opacity="0">
                <g transform="translate(640 640)">
                  <rect id="as-evse-body" x="-34" y="-90" width="68" height="150" rx="10" fill="#0F172A" stroke="#22C55E" strokeOpacity=".8" strokeWidth="1.5" />
                  <rect x="-26" y="-74" width="52" height="30" rx="4" fill="#052E1A" />
                  <text id="as-evse-screen" y="-54" textAnchor="middle" fill="#86EFAC" fontSize="10" className="mono">READY</text>
                  <text y="84" textAnchor="middle" fill="#F8FAFC" fontSize="13" fontWeight="600">Charging station</text>
                  <text y="101" textAnchor="middle" fill="#64748B" fontSize="11">EVSE</text>
                </g>
              </g>
              <path id="as-cable" d="M410 690 C 500 700, 560 700, 606 660" pathLength={1} strokeDasharray="1" strokeDashoffset="1" fill="none" stroke="#38BDF8" strokeOpacity=".7" strokeWidth="3" />
              <text id="as-iso-label" opacity="0" x="470" y="728" fill="#7DD3FC" fontSize="11" className="mono">ISO 15118</text>

              <g id="as-wifi" opacity="0"><g transform="translate(880 470)">
                <rect x="-46" y="-20" width="92" height="40" rx="8" fill="#0F172A" stroke="#94A3B8" strokeOpacity=".6" />
                <path d="M-18 -20 v-22 M18 -20 v-22" stroke="#94A3B8" strokeOpacity=".6" />
                <text y="5" textAnchor="middle" fill="#E2E8F0" fontSize="12">Site wifi</text>
              </g></g>

              <g id="as-csms-node" opacity="0"><g transform="translate(1320 250)">
                <circle r="120" fill="url(#as-glow)" opacity=".6" />
                <rect x="-90" y="-60" width="180" height="120" rx="12" fill="#0B1220" stroke="#22C55E" strokeOpacity=".55" />
                <text y="-34" textAnchor="middle" fill="#F8FAFC" fontSize="14" fontWeight="600">CSMS</text>
                <text y="-16" textAnchor="middle" fill="#64748B" fontSize="10.5">heartbeats from stations</text>
                <polyline id="as-hb" fill="none" stroke="#22C55E" strokeWidth="2" points="" />
                <text id="as-csms-status" y="46" textAnchor="middle" fill="#86EFAC" fontSize="11" className="mono">12 / 12 stations online</text>
                <text id="as-csms-note" y="80" textAnchor="middle" fill="#94A3B8" fontSize="10" opacity="0">expected effect · not measured in the dataset</text>
              </g></g>

              <path id="as-wire1" d="M674 590 C 760 560, 800 500, 834 480" pathLength={1} strokeDasharray="1" strokeDashoffset="1" fill="none" stroke="#22C55E" strokeOpacity=".45" strokeWidth="2.5" />
              <path id="as-wire2" d="M926 460 C 1040 420, 1150 330, 1230 290" pathLength={1} strokeDasharray="1" strokeDashoffset="1" fill="none" stroke="#22C55E" strokeOpacity=".45" strokeWidth="2.5" />
              <text id="as-ocpp-label" opacity="0" x="1010" y="360" fill="#86EFAC" fontSize="11" className="mono" transform="rotate(-24 1010 360)">OCPP · WebSocket</text>

              <g id="as-attacker" opacity="0" transform="translate(1020 660)">
                <circle r="80" fill="url(#as-glowR)" />
                <rect x="-44" y="-26" width="88" height="54" rx="6" fill="#1A0A10" stroke="#F43F5E" strokeOpacity=".7" />
                <rect x="-56" y="28" width="112" height="7" rx="3" fill="#1A0A10" stroke="#F43F5E" strokeOpacity=".7" />
                <text y="6" textAnchor="middle" fill="#FDA4AF" fontSize="11" className="mono">nmap / hping</text>
                <text y="58" textAnchor="middle" fill="#F8FAFC" fontSize="13" fontWeight="600">Attacker on the wifi</text>
              </g>
              <path id="as-wireA" d="M990 630 C 960 580, 930 530, 900 492" fill="none" stroke="#F43F5E" strokeOpacity="0" strokeWidth="2" strokeDasharray="5 6" />
              {/* attack onward from the wifi to the station: the target */}
              <path id="as-wire1r" d="M834 480 C 800 500, 760 560, 674 590" fill="none" stroke="none" />
              {/* switch mirror port -> Sentinel (a copy; the original carries on) */}
              <g className="as-mirror" opacity="0">
                <path id="as-mirror-path" d="M836 468 C 812 440, 800 404, 782 394" fill="none" stroke="#22C55E" strokeOpacity=".6" strokeWidth="1.5" strokeDasharray="3 5" />
                <path id="as-mirror-v2g" d="M652 552 C 664 500, 690 452, 700 412" fill="none" stroke="#22C55E" strokeOpacity=".4" strokeWidth="1.5" strokeDasharray="3 5" />
                <text x="812" y="418" fill="#86EFAC" fontSize="10.5" className="mono">mirror copy</text>
              </g>

              <g id="as-sentinel" opacity="0" transform={`translate(${SENTINEL_AT.x} ${SENTINEL_AT.y})`}>
                <circle id="as-sent-glow" r="110" fill="url(#as-glow)" />
                <rect x="-80" y="-30" width="160" height="60" rx="14" fill="#052E1A" stroke="#22C55E" strokeWidth="2" />
                <path d="M-58 -8 l10 -8 l10 8 v10 q-10 8 -10 8 q0 0 -10 -8z" fill="none" stroke="#86EFAC" strokeWidth="1.5" />
                <text x="10" y="-2" textAnchor="middle" fill="#F8FAFC" fontSize="14" fontWeight="700">Sentinel</text>
                <text x="10" y="15" textAnchor="middle" fill="#86EFAC" fontSize="10.5" className="mono">mirror-port IDS</text>
                <text id="as-alert" x="0" y="-44" textAnchor="middle" fill="#FDA4AF" fontSize="13" fontWeight="700" opacity="0" />
              </g>

              <g id="as-packets" />
            </g>
          </g>
        </svg>

        {/* ── 5: inside Sentinel ─────────────────────── */}
        <div className="overlay" id="as-pipe">
          <div className="pipe">
            <div className="card step">
              <div className="k">01 · CAPTURE</div><h4>Packets at the tap</h4>
              {[":443", ":8080", ":22"].map((port) => (
                <div key={port} className="row"><span>TCP SYN →</span><span>{port}</span></div>
              ))}
              <div className="row"><span>… 904 pkts</span><span /></div>
            </div>
            <div className="card step">
              <div className="k">02 · FLOW</div><h4>One flow, 60 features</h4>
              {[["syn_packets", "904", 92], ["mean_piat_ms", "1.9", 18], ["duration_ms", "1,794", 40], ["dst_port", "443", 55]].map(([k, v, w]) => (
                <div key={k as string}>
                  <div className="row"><span>{k}</span><span>{v}</span></div>
                  <div className="bar"><i style={{ width: `${w}%` }} /></div>
                </div>
              ))}
            </div>
            <div className="card step">
              <div className="k">03 · LEAK FILTER</div><h4>Strip the fingerprints</h4>
              <div className="row cutme"><span>*_seen_ms</span><span>×6</span></div>
              <div className="row cutme"><span>src_port</span><span>×1</span></div>
              <div className="row"><span>dst_port</span><span>kept</span></div>
              <p style={{ fontSize: 11, color: "#64748B", margin: "8px 0 0", lineHeight: 1.45 }}>
                Timestamps say <i>when</i> it was recorded, not <i>what</i> it is.
              </p>
            </div>
            <div className="card step">
              <div className="k">04 · MODELS</div><h4>Four static + one online</h4>
              {["RF", "DT", "LR", "SVM", "ARF · online"].map((m) => (
                <div key={m} className="model"><span>{m}</span><b>SYN Flood</b></div>
              ))}
            </div>
            <div className="card step">
              <div className="k">05 · VERDICT</div>
              <div style={{ fontSize: 20, fontWeight: 600, margin: "4px 0 6px", color: "#F8FAFC" }}>SYN Flood</div>
              <span className="chip" style={{ background: "rgba(167,139,250,.16)", color: "#C4B5FD" }}>Denial of service</span>{" "}
              <span className="chip" style={{ background: "rgba(234,88,12,.22)", color: "#FED7AA" }}>High</span>
              <p style={{ fontSize: 11.5, color: "#94A3B8", margin: "10px 0 0", lineHeight: 1.5 }}>
                Floods are named exactly 100% of the time in testing.
              </p>
            </div>
          </div>
        </div>

        {/* ── 6: who acts ────────────────────────────── */}
        <div className="overlay" id="as-resp">
          <div className="resp">
            <div className="card" style={{ padding: "16px 18px", display: "flex", gap: 16, alignItems: "center", borderColor: "rgba(244,63,94,.35)" }}>
              <span className="pulse" />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, color: "#F8FAFC" }}>SYN Flood aimed at charging station EVSE-A</div>
                <div className="mono" style={{ fontSize: 11.5, color: "#94A3B8", marginTop: 3 }}>from a device on the site wifi · severity high · Random Forest</div>
              </div>
            </div>
            <div className="roles">
              {[
                { who: "Station owner", color: "#7DD3FC", title: "Keep drivers charging",
                  steps: ["Confirm offline charging is on, so sessions queue locally.", "Flag the station on its display instead of failing silently."] },
                { who: "CSMS operator", color: "#86EFAC", title: "Protect the backend",
                  steps: ["Rate-limit the OCPP endpoint per source.", "Hold remote resets until the flood stops."] },
                { who: "Network analyst", color: "#C4B5FD", title: "Stop the source",
                  steps: ["Enable SYN cookies; shorten the SYN-RECEIVED timeout.", "Block the source at the edge; keep a packet sample."] },
              ].map((r) => (
                <div key={r.who} className="card role">
                  <div className="who" style={{ color: r.color }}>{r.who}</div>
                  <h4>{r.title}</h4>
                  <ul>{r.steps.map((s) => <li key={s}>{s}</li>)}</ul>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── 7: what we measured ────────────────────── */}
        <div className="overlay" id="as-res">
          <div className="results">
            <div className="stats">
              {[
                { v: 100, color: "#22C55E", l: "Floods named exactly", s: "5 of 5 volumetric floods, every model, every seed." },
                { v: 96, color: "#F59E0B", l: "Scans recognised as scans", s: "But named only 34% — six nmap modes look alike at flow level." },
                { v: 2, color: "#38BDF8", l: "False alarms · Random Forest", s: "The recommended primary detector. SVM: 59%." },
              ].map((x) => (
                <div key={x.l} className="card stat">
                  <div className="v" style={{ color: x.color }} data-count={x.v}>0%</div>
                  <div className="l">{x.l}</div>
                  <div className="s">{x.s}</div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <a href="/simulation" className="rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-medium text-emerald-950 hover:bg-emerald-400 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                Launch an attack yourself
              </a>
              <a href="/dashboard" className="rounded-lg border border-white/15 px-4 py-2.5 text-sm font-medium text-slate-100 hover:bg-white/5 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400">
                See the findings
              </a>
            </div>
          </div>
        </div>

        {/* narrative */}
        <div className={`narrative ${chapter >= 1 && chapter <= 3 ? "top" : ""}`} aria-live="polite">
          {CHAPTERS.map((c, i) => (
            <article key={c.k} className={`chapter ${i === chapter && textOn ? "on" : ""}`} aria-hidden={i !== chapter || !textOn}>
              <div className="num">{String(i + 1).padStart(2, "0")} · {c.k}</div>
              <h2>{c.title}</h2>
              <p>{c.body}</p>
              <div className="fact" dangerouslySetInnerHTML={{ __html: c.fact }} />
            </article>
          ))}
        </div>

        <nav className="rail" aria-label="Story chapters">
          <ol>
            {CHAPTERS.map((c, i) => (
              <li key={c.k} className={i === chapter ? "on" : i < chapter ? "done" : ""}>
                <button type="button" onClick={() => jumpTo(i)} aria-current={i === chapter ? "step" : undefined}>
                  <span className="dot" /><span className="lbl">{c.k}</span>
                </button>
              </li>
            ))}
          </ol>
        </nav>
        <div className="progress"><i /></div>
      </div>
    </section>
  );
}

/** Reduced motion: the same story as a plain sequence, nothing pinned or animated. */
function StaticStory() {
  return (
    <section id="architecture" className="arch-story arch-story-static mx-auto max-w-3xl px-6 py-24">
      <p className="mono text-[11px] uppercase tracking-[0.16em] text-emerald-400">How it works</p>
      {CHAPTERS.map((c, i) => (
        <article key={c.k}>
          <p className="mono text-[11px] uppercase tracking-[0.16em] text-slate-500">{String(i + 1).padStart(2, "0")} · {c.k}</p>
          <h2 className="mt-2 text-2xl font-semibold text-white">{c.title}</h2>
          <p className="mt-2 text-slate-400">{c.body}</p>
          <p className="mt-3 text-sm text-slate-500" dangerouslySetInnerHTML={{ __html: c.fact }} />
        </article>
      ))}
    </section>
  );
}
