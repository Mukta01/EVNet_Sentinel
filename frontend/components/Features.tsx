"use client";

import { motion } from "framer-motion";
import {
  ShieldAlert,
  Wifi,
  ServerCrash,
  Lock,
  Zap,
  CircuitBoard,
} from "lucide-react";
import PixelBlast from "./PixelBlast";
import ThreatAccordion from "./ThreatAccordion";
import FoldText from "./FoldText";

const threats = [
  {
    icon: <Wifi className="w-6 h-6" />,
    title: "OCPP Protocol Exploitation",
    description:
      "Attackers intercept OCPP messages between EVSE chargers and CSMS cloud backends to inject malicious charging commands.",
    color: "text-red-400",
    border: "border-red-500/20",
    bg: "bg-red-500/[0.02]",
    glow: "shadow-[0_0_30px_-5px_rgba(239,68,68,0.15)]",
    iconBg: "bg-red-500/10",
    image: "https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=800&auto=format&fit=crop&q=60"
  },
  {
    icon: <ServerCrash className="w-6 h-6" />,
    title: "Denial of Service",
    description:
      "Flooding charging station networks to render them inoperable, disrupting EV charging infrastructure at scale.",
    color: "text-orange-400",
    border: "border-orange-500/20",
    bg: "bg-orange-500/[0.02]",
    glow: "shadow-[0_0_30px_-5px_rgba(249,115,22,0.15)]",
    iconBg: "bg-orange-500/10",
    image: "https://images.unsplash.com/photo-1544197150-b99a580bb7a8?w=800&auto=format&fit=crop&q=60"
  },
  {
    icon: <Lock className="w-6 h-6" />,
    title: "Firmware Manipulation",
    description:
      "Compromising EVSE firmware to install backdoors, enabling persistent unauthorized access to charging networks.",
    color: "text-yellow-400",
    border: "border-white/[0.1] hover:border-yellow-500/60",
    bg: "bg-white/[0.03] hover:bg-yellow-950/30",
    glow: "hover:shadow-[0_0_30px_rgba(234,179,8,0.25)]",
    iconBg: "bg-yellow-500/10",
    image: "https://images.unsplash.com/photo-1518770660439-4636190af475?w=800&auto=format&fit=crop&q=60"
  },
  {
    icon: <CircuitBoard className="w-6 h-6" />,
    title: "Man-in-the-Middle Attacks",
    description:
      "Intercepting unencrypted traffic between vehicles and stations to steal credentials or manipulate charging sessions.",
    color: "text-violet-400",
    border: "border-purple-500/20",
    bg: "bg-purple-500/[0.02]",
    glow: "shadow-[0_0_30px_-5px_rgba(168,85,247,0.15)]",
    iconBg: "bg-violet-500/10",
    image: "https://images.unsplash.com/photo-1558494949-ef010cbdcc31?w=800&auto=format&fit=crop&q=60"
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Grid Overload Attacks",
    description:
      "Coordinated manipulation of multiple chargers to create sudden demand spikes that could destabilize the power grid.",
    color: "text-cyan-400",
    border: "border-cyan-500/20",
    bg: "bg-cyan-500/[0.02]",
    glow: "shadow-[0_0_30px_-5px_rgba(6,182,212,0.15)]",
    iconBg: "bg-cyan-500/10",
    image: "https://images.unsplash.com/photo-1473341304170-971dccb5ac1e?w=800&auto=format&fit=crop&q=60"
  },
  {
    icon: <ShieldAlert className="w-6 h-6" />,
    title: "Data Exfiltration",
    description:
      "Extracting sensitive user payment data, vehicle identifiers, and location patterns from compromised EVCS endpoints.",
    color: "text-pink-400",
    border: "border-pink-500/20",
    bg: "bg-pink-500/[0.02]",
    glow: "shadow-[0_0_30px_-5px_rgba(236,72,153,0.15)]",
    iconBg: "bg-pink-500/10",
    image: "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=800&auto=format&fit=crop&q=60"
  },
];

export default function Features() {
  return (
    <>
      <section id="threat" className="relative py-32 overflow-hidden">
        <div className="absolute inset-0 z-0 opacity-40">
          <PixelBlast
            color="#ef4444"
            variant="square"
            pixelSize={4}
            patternScale={2}
            patternDensity={1}
            speed={0.5}
            enableRipples={true}
            rippleSpeed={0.3}
            rippleThickness={0.1}
          />
        </div>
        {/* Subtle background accent */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/[0.04] rounded-full blur-[150px] pointer-events-none z-0" />

        <div className="max-w-7xl mx-auto px-6 relative z-10 pointer-events-none">
          <div className="pointer-events-auto">
            {/* Section header */}
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px" }}
          transition={{ duration: 0.6 }}
          className="max-w-3xl mb-20"
        >
          <div className="inline-flex items-center space-x-2 bg-red-500/[0.08] border border-red-500/20 text-red-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-6">
            <ShieldAlert className="w-3 h-3" />
            <span>The Threat Landscape</span>
          </div>
          <div className="mb-6 leading-none">
            <FoldText
              text="EV Charging Stations"
              trigger="scroll"
              fontSize="clamp(2.5rem, 5vw, 3.5rem)"
              fontWeight={800}
              color="#ffffff"
            />
            <br />
            <FoldText
              text="are under attack."
              trigger="scroll"
              fontSize="clamp(2.5rem, 5vw, 3.5rem)"
              fontWeight={800}
              color="#6b7280"
              stagger={0.06}
            />
          </div>
          <motion.p 
            className="text-lg text-gray-400 leading-relaxed max-w-2xl font-light"
            variants={{
              hidden: { opacity: 0 },
              visible: { opacity: 1, transition: { staggerChildren: 0.02, delayChildren: 0.4 } },
            }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, margin: "0px" }}
          >
            {"As the world electrifies transportation, charging infrastructure becomes critical — and a prime target. These are the real threats facing EVCS networks today.".split(" ").map((word, i) => (
              <motion.span
                key={i}
                variants={{
                  hidden: { opacity: 0, filter: 'blur(8px)', y: 15 },
                  visible: { opacity: 1, filter: 'blur(0px)', y: 0, transition: { duration: 0.5 } },
                }}
                className="inline-block mr-[0.25em]"
              >
                {word}
              </motion.span>
            ))}
          </motion.p>
        </motion.div>

        {/* Threat cards (Accordion effect) */}
        <div className="mt-12 w-full max-w-7xl">
          <ThreatAccordion threats={threats} />
        </div>
      </div>
        </div>
      </section>
    </>
  );
}
