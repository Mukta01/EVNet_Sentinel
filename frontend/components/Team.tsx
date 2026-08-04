"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";

const team = [
  {
    name: "Shardul Chogale",
    role: "ML Pipelining and Evaluation",
    handle: "@shard-c6",
    github: "https://github.com/shard-c6",
    zone: "Primary: ML Training · Secondary: Model Optimization",
    gradient: "from-blue-500 to-cyan-400",
    initial: "S",
  },
  {
    name: "Mukta Varak",
    role: "Cloud Deployment DevOps",
    handle: "@Mukta01",
    github: "https://github.com/Mukta01",
    zone: "Primary: Cloud Deployment · Secondary: DevOps",
    gradient: "from-violet-500 to-purple-400",
    initial: "M",
  },
  {
    name: "Neha Chavhan",
    role: "Frontend and API Integration",
    handle: "@nehachavhan2006",
    github: "http://github.com/nehachavhan2006",
    zone: "Primary: Frontend · Secondary: API Integration",
    gradient: "from-emerald-500 to-teal-400",
    initial: "N",
  },
  {
    name: "Shruti Chaurasiya",
    role: "Data Visualization & Testing DevOps",
    handle: "@shrutich-30",
    github: "http://github.com/shrutich-30",
    zone: "Primary: Data Viz · Secondary: Frontend Support",
    gradient: "from-pink-500 to-rose-400",
    initial: "Sh",
  },
];

export default function Team() {
  return (
    <section id="team" className="relative py-32 overflow-hidden">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-blue-500/[0.03] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "0px" }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <div className="inline-flex items-center space-x-2 bg-blue-500/[0.08] border border-blue-500/20 text-blue-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-6">
            <span>The Team</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
            Built by a<br />
            <span className="text-gray-500">cross-functional team.</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-xl mx-auto font-light">
            Flexible ownership zones — everyone can contribute anywhere, but each person
            drives progress in their primary area.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 max-w-6xl mx-auto">
          {team.map((member, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "0px" }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              className="group bg-white/[0.02] border border-white/[0.06] rounded-2xl p-6 hover:border-white/10 hover:bg-white/[0.04] transition-all duration-300"
            >
              {/* Avatar */}
              <div className="mb-6">
                <div
                  className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${member.gradient} flex items-center justify-center text-white text-xl font-bold shadow-lg group-hover:scale-110 transition-transform duration-300`}
                >
                  {member.initial}
                </div>
              </div>

              {/* Info */}
              <h3 className="text-lg font-bold text-white mb-1 tracking-tight">
                {member.name}
              </h3>
              <p className="text-sm text-emerald-400 font-medium mb-3">{member.role}</p>
              <p className="text-xs text-gray-500 font-mono mb-4">{member.handle}</p>

              {/* Zone badge */}
              <div className="bg-white/[0.03] border border-white/[0.06] rounded-lg p-3 text-[11px] text-gray-400 leading-relaxed">
                {member.zone}
              </div>

              {/* Social */}
              {member.github && (
                <div className="mt-4 flex space-x-2">
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-gray-600 hover:text-white transition-colors cursor-pointer"
                    aria-label={`${member.name} GitHub`}
                  >
                    <ExternalLink className="w-4 h-4" />
                  </a>
                </div>
              )}
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
