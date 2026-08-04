"use client";

import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import mermaid from "mermaid";
import {
  Database,
  Cpu,
  Server,
  LayoutDashboard,
  Activity,
  ArrowRight,
} from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const mermaidChart = `
graph TB
    classDef data fill:#0c1a30,stroke:#3b82f6,stroke-width:2px,color:#93c5fd;
    classDef ml fill:#1a0c30,stroke:#8b5cf6,stroke-width:2px,color:#c4b5fd;
    classDef api fill:#0c2a1a,stroke:#22c55e,stroke-width:2px,color:#86efac;
    classDef ui fill:#2a0c1a,stroke:#ec4899,stroke-width:2px,color:#f9a8d4;

    subgraph DL ["DATA LAYER"]
        D1[CICEVSE2024<br/>Network Traffic CSVs]:::data
        D2[Synthetic<br/>Malicious Traffic]:::data
    end

    subgraph BE ["PYTHON BACKEND · FastAPI :8000"]
        PP[Preprocessing<br/>PII Mask · RFE · Scaling]:::ml
        subgraph ML ["DETECTION ENGINE"]
            S1[Random Forest]:::ml
            S2[SVM]:::ml
            S3[Logistic Reg]:::ml
            S4[Decision Tree]:::ml
            OL[ARF + ADWIN<br/>Online Learning]:::ml
        end
        API[REST API Layer]:::api
        WS[WebSocket<br/>/ws/alerts]:::api
    end

    subgraph FE ["NEXT.JS FRONTEND :3000"]
        UI1[Dashboard Overview]:::ui
        UI2[Animated Metrics<br/>Framer Motion]:::ui
        UI3[Confusion Matrix<br/>Recharts/visx]:::ui
        UI4[Live Alert Feed<br/>WebSocket Stream]:::ui
    end

    D1 --> PP
    D2 --> PP
    PP --> S1 & S2 & S3 & S4
    PP --> OL
    S1 & S2 & S3 & S4 --> API
    OL --> API
    OL -.->|alert event| WS
    API -->|REST| UI1
    API -->|REST| UI2
    API -->|REST| UI3
    WS -->|push| UI4
`;

const layers = [
  {
    id: "data",
    icon: <Database className="w-5 h-5" />,
    title: "Data Layer",
    tech: "CICEVSE2024 · Python Generator",
    color: "text-blue-400",
    activeBg: "bg-blue-500/20 border-blue-400/50 shadow-[0_0_15px_rgba(59,130,246,0.3)]",
    description:
      "Real-world network traffic from physical (EVSE-A) and emulated (EVSE-B) charging stations, supplemented by configurable synthetic attack injection for coverage beyond the recorded dataset.",
  },
  {
    id: "ml",
    icon: <Cpu className="w-5 h-5" />,
    title: "ML Detection Engine",
    tech: "scikit-learn · River · ADWIN",
    color: "text-violet-400",
    activeBg: "bg-violet-500/20 border-violet-400/50 shadow-[0_0_15px_rgba(139,92,246,0.3)]",
    description:
      "PII masking, Recursive Feature Elimination, four static classifiers (RF, SVM, LR, DT) with fixed seeds for reproducibility, and Adaptive Random Forest with ADWIN concept-drift detection for streaming data.",
  },
  {
    id: "api",
    icon: <Server className="w-5 h-5" />,
    title: "FastAPI Backend",
    tech: "REST · WebSocket · Uvicorn",
    color: "text-emerald-400",
    activeBg: "bg-emerald-500/20 border-emerald-400/50 shadow-[0_0_15px_rgba(16,185,129,0.3)]",
    description:
      "Async Python backend serving model metrics, classification reports, and confusion matrices via REST. Real-time alert stream pushed over WebSocket. CORS locked to localhost:3000.",
  },
  {
    id: "frontend",
    icon: <LayoutDashboard className="w-5 h-5" />,
    title: "Next.js Dashboard",
    tech: "React · Tailwind · Framer Motion",
    color: "text-pink-400",
    activeBg: "bg-pink-500/20 border-pink-400/50 shadow-[0_0_15px_rgba(236,72,153,0.3)]",
    description:
      "Decoupled presentation layer for security analysts. Animated 60fps metric transitions, interactive confusion matrix heatmap, live WebSocket alert feed with configurable simulation controls.",
  },
];

export default function Architecture() {
  const sectionRef = useRef<HTMLElement>(null);
  const [activeLayer, setActiveLayer] = useState("data");
  const [svgContent, setSvgContent] = useState("");

  useEffect(() => {
    mermaid.initialize({
      startOnLoad: false,
      theme: "dark",
      securityLevel: "loose",
      fontFamily: "var(--font-mono), monospace",
      themeVariables: {
        darkMode: true,
        background: "#020617",
        lineColor: "#334155",
      },
    });
    const render = async () => {
      try {
        const { svg } = await mermaid.render(`arch-${Date.now()}`, mermaidChart);
        setSvgContent(svg);
      } catch {
        /* fallback handled in UI */
      }
    };
    render();
  }, []);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.from(".arch-headline", {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: "expo.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      });
      gsap.from(".arch-diagram", {
        opacity: 0,
        scale: 0.95,
        duration: 1,
        ease: "expo.out",
        scrollTrigger: { trigger: ".arch-diagram", start: "top 80%" },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  const active = layers.find((l) => l.id === activeLayer)!;

  return (
    <section ref={sectionRef} id="architecture" className="relative py-32 overflow-hidden">
      <div className="absolute bottom-0 right-0 w-[500px] h-[500px] bg-violet-500/[0.04] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-7xl mx-auto px-6 relative z-10">
        {/* Header */}
        <div className="arch-headline max-w-3xl mb-16">
          <div className="inline-flex items-center space-x-2 bg-violet-500/[0.08] border border-violet-500/20 text-violet-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-6">
            <Activity className="w-3 h-3" />
            <span>System Architecture</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
            How EVNet Sentinel<br />
            <span className="text-gray-500">detects threats.</span>
          </h2>
          <p className="text-lg text-gray-400 leading-relaxed font-light">
            A decoupled two-tier system separating heavy ML inference from the interactive
            visualization layer, connected via REST + WebSocket.
          </p>
        </div>

        {/* Mermaid Diagram */}
        <div className="arch-diagram bg-[#060a14] border border-white/[0.06] rounded-2xl p-6 md:p-10 mb-12 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-2">
              <div className="w-3 h-3 rounded-full bg-red-500/80" />
              <div className="w-3 h-3 rounded-full bg-yellow-500/80" />
              <div className="w-3 h-3 rounded-full bg-green-500/80" />
              <span className="ml-3 text-xs text-gray-600 font-mono">system-architecture.mmd</span>
            </div>
            <span className="text-[10px] font-mono text-gray-600 bg-white/[0.03] px-2 py-1 rounded">
              SRS v1.2
            </span>
          </div>
          <div className="overflow-x-auto flex justify-center min-h-[300px] items-center">
            {svgContent ? (
              <div
                className="w-full flex justify-center [&_svg]:max-w-full [&_svg]:h-auto"
                dangerouslySetInnerHTML={{ __html: svgContent }}
              />
            ) : (
              <div className="flex items-center space-x-2 text-gray-600 text-sm">
                <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="font-mono">Rendering flowchart...</span>
              </div>
            )}
          </div>
        </div>

        {/* Layer Explorer */}
        <div className="arch-tabs grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Tabs */}
          <div className="lg:col-span-4 space-y-3">
            {layers.map((layer) => (
              <button
                key={layer.id}
                onClick={() => setActiveLayer(layer.id)}
                className={`arch-tab w-full flex items-center space-x-4 p-4 rounded-xl border text-left transition-all duration-300 cursor-pointer ${
                  activeLayer === layer.id
                    ? `${layer.activeBg} shadow-lg`
                    : "bg-white/[0.02] border-white/[0.06] hover:bg-white/[0.04] hover:border-white/10"
                }`}
              >
                <div className={`${layer.color} transition-colors`}>{layer.icon}</div>
                <div>
                  <div className="font-semibold text-sm text-white">{layer.title}</div>
                  <div className="text-[11px] text-gray-500 font-mono">{layer.tech}</div>
                </div>
                {activeLayer === layer.id && (
                  <ArrowRight className={`w-4 h-4 ml-auto ${layer.color}`} />
                )}
              </button>
            ))}
          </div>

          {/* Detail panel */}
          <div className="lg:col-span-8">
            <div
              className={`h-full border rounded-2xl p-8 transition-all duration-500 ${active.activeBg}`}
            >
              <div className="flex items-center space-x-3 mb-4">
                <div className={active.color}>{active.icon}</div>
                <h3 className="text-xl font-bold text-white">{active.title}</h3>
              </div>
              <div className="text-xs font-mono text-gray-500 bg-white/[0.03] inline-block px-3 py-1.5 rounded-lg border border-white/[0.06] mb-5">
                {active.tech}
              </div>
              <p className="text-gray-300 leading-relaxed text-[15px]">
                {active.description}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
