"use client";

import { useRef } from "react";
import { motion, useScroll, useTransform } from "framer-motion";

export default function TeslaTransition() {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"],
  });

  // Start off-screen right (120%), end off-screen left (-120%)
  const x = useTransform(scrollYProgress, [0, 1], ["150%", "-150%"]);
  // Optional: Make it scale or change opacity if needed, but a straight drive-by is cool.

  return (
    <div ref={containerRef} className="relative w-full h-[150px] overflow-hidden -my-8 z-20">
      <motion.div 
        style={{ x }}
        className="absolute top-1/2 -translate-y-1/2 w-[300px] md:w-[400px] lg:w-[500px]"
      >
        <svg viewBox="0 0 800 200" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto drop-shadow-[0_0_15px_rgba(16,185,129,0.3)]">
          {/* Sleek Tesla-like Silhouette */}
          <path d="M 650 140 L 730 140 C 760 140 780 120 780 100 C 780 80 760 70 700 65 L 550 40 C 500 30 450 30 400 35 L 200 60 C 150 65 100 80 80 100 C 60 120 80 140 120 140 L 150 140" stroke="url(#tesla-grad)" strokeWidth="6" strokeLinecap="round" />
          <path d="M 230 140 L 570 140" stroke="url(#tesla-grad)" strokeWidth="6" strokeLinecap="round" />
          {/* Wheels */}
          <circle cx="190" cy="140" r="35" stroke="#10b981" strokeWidth="8" fill="#020617" />
          <circle cx="610" cy="140" r="35" stroke="#10b981" strokeWidth="8" fill="#020617" />
          <circle cx="190" cy="140" r="15" fill="#3b82f6" />
          <circle cx="610" cy="140" r="15" fill="#3b82f6" />
          {/* Glowing accents */}
          <path d="M 770 90 L 775 95" stroke="#ef4444" strokeWidth="8" strokeLinecap="round" className="animate-pulse" />
          <path d="M 85 95 L 90 90" stroke="#facc15" strokeWidth="8" strokeLinecap="round" className="animate-pulse" />
          {/* Charging Port Glow */}
          <circle cx="660" cy="100" r="4" fill="#10b981" className="animate-ping" />
          
          <defs>
            <linearGradient id="tesla-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#10b981" />
              <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
            </linearGradient>
          </defs>
        </svg>
      </motion.div>
    </div>
  );
}
