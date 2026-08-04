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

const threats = [
  {
    icon: <Wifi className="w-6 h-6" />,
    title: "OCPP Protocol Exploitation",
    description:
      "Attackers intercept OCPP messages between EVSE chargers and CSMS cloud backends to inject malicious charging commands.",
    color: "text-red-400",
    border: "border-white/[0.1] hover:border-red-500/60",
    bg: "bg-white/[0.03] hover:bg-red-950/30",
    glow: "hover:shadow-[0_0_30px_rgba(239,68,68,0.25)]",
    iconBg: "bg-red-500/10",
  },
  {
    icon: <ServerCrash className="w-6 h-6" />,
    title: "Denial of Service",
    description:
      "Flooding charging station networks to render them inoperable, disrupting EV charging infrastructure at scale.",
    color: "text-orange-400",
    border: "border-white/[0.1] hover:border-orange-500/60",
    bg: "bg-white/[0.03] hover:bg-orange-950/30",
    glow: "hover:shadow-[0_0_30px_rgba(249,115,22,0.25)]",
    iconBg: "bg-orange-500/10",
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
  },
  {
    icon: <CircuitBoard className="w-6 h-6" />,
    title: "Man-in-the-Middle Attacks",
    description:
      "Intercepting unencrypted traffic between vehicles and stations to steal credentials or manipulate charging sessions.",
    color: "text-violet-400",
    border: "border-white/[0.1] hover:border-violet-500/60",
    bg: "bg-white/[0.03] hover:bg-violet-950/30",
    glow: "hover:shadow-[0_0_30px_rgba(139,92,246,0.25)]",
    iconBg: "bg-violet-500/10",
  },
  {
    icon: <Zap className="w-6 h-6" />,
    title: "Grid Overload Attacks",
    description:
      "Coordinated manipulation of multiple chargers to create sudden demand spikes that could destabilize the power grid.",
    color: "text-cyan-400",
    border: "border-white/[0.1] hover:border-cyan-500/60",
    bg: "bg-white/[0.03] hover:bg-cyan-950/30",
    glow: "hover:shadow-[0_0_30px_rgba(6,182,212,0.25)]",
    iconBg: "bg-cyan-500/10",
  },
  {
    icon: <ShieldAlert className="w-6 h-6" />,
    title: "Data Exfiltration",
    description:
      "Extracting sensitive user payment data, vehicle identifiers, and location patterns from compromised EVCS endpoints.",
    color: "text-pink-400",
    border: "border-white/[0.1] hover:border-pink-500/60",
    bg: "bg-white/[0.03] hover:bg-pink-950/30",
    glow: "hover:shadow-[0_0_30px_rgba(236,72,153,0.25)]",
    iconBg: "bg-pink-500/10",
  },
];

export default function Features() {
  return (
    <section id="threat" className="relative py-32 overflow-hidden">
      {/* Subtle background accent */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-red-500/[0.04] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
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
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
            EV Charging Stations<br />
            <span className="text-gray-500">are under attack.</span>
          </h2>
          <p className="text-lg text-gray-400 leading-relaxed max-w-2xl font-light">
            As the world electrifies transportation, charging infrastructure becomes critical
            — and a prime target. These are the real threats facing EVCS networks today.
          </p>
        </motion.div>

        {/* Threat cards (bento grid) */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {threats.map((threat, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className={`threat-card group relative ${threat.bg} border ${threat.border} ${threat.glow} rounded-2xl p-7 transition-all duration-300 hover:scale-[1.02] cursor-default`}
            >
              <div
                className={`w-12 h-12 rounded-xl ${threat.iconBg} border ${threat.border.split(" ")[0]} flex items-center justify-center mb-5 ${threat.color} transition-transform group-hover:scale-110`}
              >
                {threat.icon}
              </div>
              <h3 className="text-lg font-bold text-white mb-3 tracking-tight">
                {threat.title}
              </h3>
              <p className="text-sm text-gray-400 leading-relaxed">
                {threat.description}
              </p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
