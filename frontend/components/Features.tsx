"use client";

import { motion } from "framer-motion";
import { ShieldAlert } from "lucide-react";
import PixelBlast from "./PixelBlast";
import FoldText from "./FoldText";

export default function Features() {
  return (
    <>
      <section id="threat" className="relative pt-32 pb-10 overflow-hidden">
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
          className="max-w-3xl"
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
            {"As the world electrifies transportation, charging infrastructure becomes critical — and a prime target. Scroll on to see how an attack unfolds across a real city — and where Sentinel stops it.".split(" ").map((word, i) => (
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

      </div>
        </div>
      </section>
    </>
  );
}
