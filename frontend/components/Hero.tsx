"use client";

import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { ArrowDown, Shield } from "lucide-react";
import DotField from "./DotField";

gsap.registerPlugin(ScrollTrigger);

export default function Hero() {
  const sectionRef = useRef<HTMLElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const statsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      // Parallax background grid
      gsap.to(".hero-grid", {
        yPercent: 15,
        ease: "none",
        scrollTrigger: { trigger: sectionRef.current, scrub: true },
      });

      // Floating orbs
      gsap.to(".orb-1", {
        y: -80,
        x: 30,
        ease: "none",
        scrollTrigger: { trigger: sectionRef.current, scrub: true },
      });
      gsap.to(".orb-2", {
        y: -50,
        x: -40,
        ease: "none",
        scrollTrigger: { trigger: sectionRef.current, scrub: true },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const stats = [
    { value: "99.13%", label: "Binary Detection Accuracy", sub: "ARF + ADWIN" },
    { value: "<5ms", label: "Inference Latency", sub: "Per-instance" },
    { value: "4", label: "Static ML Models", sub: "RF · SVM · LR · DT" },
    { value: "Live", label: "WebSocket Alerts", sub: "Real-time stream" },
  ];

  return (
    <section
      ref={sectionRef}
      className="relative min-h-screen flex flex-col justify-center items-center overflow-hidden"
    >
      {/* Background layers */}
      <div className="absolute inset-0 z-0 pointer-events-auto">
        <DotField
          dotRadius={1.5}
          dotSpacing={14}
          bulgeStrength={67}
          glowRadius={160}
          sparkle={false}
          waveAmplitude={0}
          cursorRadius={500}
          cursorForce={0.1}
          bulgeOnly
          gradientFrom="#10b981" 
          gradientTo="#3b82f6" 
          glowColor="#020617"
        />
      </div>
      <div className="absolute inset-0 z-0 pointer-events-none bg-gradient-to-b from-transparent via-[#020617]/50 to-[#020617]" />

      {/* Decorative orbs */}
      <div className="orb-1 absolute top-[20%] left-[15%] w-[500px] h-[500px] rounded-full bg-blue-600/[0.07] blur-[120px] pointer-events-none" />
      <div className="orb-2 absolute bottom-[10%] right-[10%] w-[400px] h-[400px] rounded-full bg-emerald-500/[0.07] blur-[120px] pointer-events-none" />
      <div className="absolute top-[60%] left-[50%] w-[300px] h-[300px] rounded-full bg-violet-500/[0.05] blur-[100px] pointer-events-none" />

      {/* Content */}
      <div className="relative z-10 max-w-5xl mx-auto px-6 text-center pt-24 pb-16">
        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
          className="inline-flex items-center space-x-2 bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 px-4 py-1.5 rounded-full mb-10 text-xs font-semibold uppercase tracking-widest"
        >
          <Shield className="w-3.5 h-3.5" />
          <span>EVCS Network Intrusion Detection</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          ref={headlineRef}
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-8"
        >
          <span className="text-white">Securing the</span>
          <br />
          <span className="gradient-text">Electric Grid</span>
        </motion.h1>

        {/* Sub */}
        <motion.p
          ref={subRef}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-12 leading-relaxed font-light"
        >
          Real-time ML-based intrusion detection for EV charging infrastructure.
          Reproducing state-of-the-art research with an interactive live-alert dashboard.
        </motion.p>

        {/* Terminal-style one-liner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="inline-flex items-center space-x-3 bg-[#0a0f1a] border border-white/[0.06] rounded-xl px-5 py-3 mb-16 font-mono text-sm"
        >
          <span className="text-emerald-400">$</span>
          <span className="text-gray-300">python -m sentinel_ids.core</span>
          <span className="text-gray-600">--mode live --model arf-adwin</span>
          <span className="w-2 h-5 bg-emerald-400 cursor-blink" />
        </motion.div>
      </div>

      {/* Stats bar */}
      <motion.div
        ref={statsRef}
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.6, ease: [0.16, 1, 0.3, 1] }}
        className="relative z-10 w-full max-w-5xl mx-auto px-6 pb-8"
      >
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {stats.map((stat, i) => (
            <div
              key={i}
              className="bg-white/[0.03] backdrop-blur-sm border border-white/[0.06] rounded-xl p-5 text-center hover:border-white/10 transition-colors"
            >
              <div className="text-2xl md:text-3xl font-bold text-white mb-1 font-mono">
                {stat.value}
              </div>
              <div className="text-xs text-gray-400 font-medium mb-0.5">{stat.label}</div>
              <div className="text-[10px] text-gray-600 font-mono">{stat.sub}</div>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 1.2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        >
          <ArrowDown className="w-5 h-5 text-gray-600" />
        </motion.div>
      </motion.div>
    </section>
  );
}
