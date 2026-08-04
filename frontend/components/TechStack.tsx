"use client";

import { motion } from "framer-motion";

export default function TechStack() {
  return (
    <section className="py-24">
      <div className="max-w-5xl mx-auto px-6 text-center">
        <h3 className="text-sm font-bold uppercase tracking-[0.2em] text-gray-600 mb-10">
          Powered By
        </h3>
        <div className="flex flex-wrap justify-center gap-3">
          {[
            { name: "Next.js 14", category: "Frontend", color: "border-white/20 text-white" },
            { name: "React 18", category: "UI", color: "border-cyan-500/30 text-cyan-400" },
            { name: "TypeScript", category: "Language", color: "border-blue-500/30 text-blue-400" },
            { name: "Tailwind CSS", category: "Styling", color: "border-teal-500/30 text-teal-400" },
            { name: "Framer Motion", category: "Animation", color: "border-violet-500/30 text-violet-400" },
            { name: "GSAP", category: "Scroll FX", color: "border-green-500/30 text-green-400" },
            { name: "FastAPI", category: "Backend", color: "border-emerald-500/30 text-emerald-400" },
            { name: "Python 3.10+", category: "Runtime", color: "border-yellow-500/30 text-yellow-400" },
            { name: "scikit-learn", category: "Static ML", color: "border-orange-500/30 text-orange-400" },
            { name: "River", category: "Online ML", color: "border-cyan-500/30 text-cyan-400" },
            { name: "WebSocket", category: "Real-time", color: "border-pink-500/30 text-pink-400" },
            { name: "Recharts", category: "Data Viz", color: "border-indigo-500/30 text-indigo-400" },
          ].map((tech, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, scale: 0.8 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.5, delay: i * 0.04 }}
              className={`inline-flex items-center space-x-2 border rounded-full px-4 py-2 bg-white/[0.02] hover:bg-white/[0.05] transition-colors ${tech.color}`}
            >
              <span className="text-sm font-semibold">{tech.name}</span>
              <span className="text-[10px] font-mono opacity-60">{tech.category}</span>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
