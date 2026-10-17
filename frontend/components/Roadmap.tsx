"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

/**
 * What was actually built, in order, with the merge dates from git history.
 * Owners are the team areas each phase belongs to.
 */
const phases = [
  {
    id: 0,
    title: "Project setup and landing page",
    status: "done",
    date: "Aug 4 – 7",
    owner: "Frontend",
    items: ["Next.js scaffold", "Landing page", "Backend scaffold", "README"],
  },
  {
    id: 1,
    title: "Data pipeline and static models",
    status: "done",
    date: "Aug 15 – 22",
    owner: "ML pipeline",
    items: ["CICEVSE2024 loading and labelling", "Feature engineering", "Random Forest, Decision Tree", "Logistic Regression, SVM (out-of-core)", "Unified evaluation"],
  },
  {
    id: 2,
    title: "Online model, API and deployment",
    status: "done",
    date: "Aug 21 – 24",
    owner: "Cloud & API",
    items: ["ARF + ADWIN streaming model", "FastAPI prediction service", "Docker image", "Compliance tests", "SRS and architecture docs"],
  },
  {
    id: 3,
    title: "Leakage audit and corrected pipeline",
    status: "done",
    date: "Sep 1 – 8",
    owner: "ML pipeline",
    items: ["Timestamp leak found (0.9976 from one column)", "src_port fingerprint removed", "Leak-free preprocessing", "All models re-run"],
  },
  {
    id: 4,
    title: "Honest evaluation and results dashboard",
    status: "done",
    date: "Sep 22 – 29",
    owner: "ML · Data viz",
    items: ["3-seed benchmarks, macro-F1", "Per-attack test harness", "Drift on file seams", "Findings dashboard", "Paper figures"],
  },
  {
    id: 5,
    title: "Interactive demo and containment",
    status: "done",
    date: "Oct 1 – 10",
    owner: "Frontend & API",
    items: ["Beat the Sentinel hero", "Mumbai scroll story", "Simulation on real attack routes", "Threat level and quarantine", "Runbook and diagrams"],
  },
  {
    id: 6,
    title: "Paper, testing and documentation",
    status: "done",
    date: "Oct 5 – 15",
    owner: "All",
    items: ["Research paper v2 and v3", "40 test cases, 71 automated tests", "Demo scripts and walkthroughs", "Public demo link"],
  },
  {
    id: 7,
    title: "Next: journal submission and follow-up research",
    status: "active",
    date: "In progress",
    owner: "All",
    items: ["Elsevier journal submission", "Grouped (per-capture) evaluation", "Packet-sequence models for scans", "Host and power data fusion"],
  },
];

function StatusIcon({ status }: { status: string }) {
  if (status === "done") return <CheckCircle2 className="w-5 h-5 text-emerald-400" />;
  if (status === "active") return <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />;
  return <Circle className="w-5 h-5 text-gray-700" />;
}

export default function Roadmap() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const prefersReduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (prefersReduced) return;

    const ctx = gsap.context(() => {
      gsap.from(".roadmap-headline", {
        opacity: 0,
        y: 50,
        duration: 0.8,
        ease: "expo.out",
        scrollTrigger: { trigger: sectionRef.current, start: "top 70%" },
      });
      gsap.from(".roadmap-item", {
        opacity: 0,
        x: -40,
        duration: 0.6,
        stagger: 0.1,
        ease: "expo.out",
        scrollTrigger: { trigger: ".roadmap-timeline", start: "top 80%" },
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} id="roadmap" className="relative py-32 overflow-hidden">
      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-emerald-500/[0.03] rounded-full blur-[150px] pointer-events-none" />

      <div className="max-w-4xl mx-auto px-6 relative z-10">
        <div className="roadmap-headline text-center mb-16">
          <div className="inline-flex items-center space-x-2 bg-emerald-500/[0.08] border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-[0.2em] mb-6">
            <span>How we built it</span>
          </div>
          <h2 className="text-4xl md:text-5xl lg:text-6xl font-extrabold text-white tracking-tight leading-[1.1] mb-6">
            From concept to<br />
            <span className="text-gray-500">an audited, working system.</span>
          </h2>
        </div>

        {/* Timeline */}
        <div className="roadmap-timeline relative">
          {/* Vertical line */}
          <div className="absolute left-[22px] top-0 bottom-0 w-px bg-gradient-to-b from-emerald-500/30 via-blue-500/20 to-transparent" />

          <div className="space-y-6">
            {phases.map((phase) => (
              <div key={phase.id} className="roadmap-item relative flex items-start space-x-6">
                {/* Dot */}
                <div className="relative z-10 mt-1 flex-shrink-0">
                  <StatusIcon status={phase.status} />
                </div>

                {/* Card */}
                <div
                  className={`flex-1 bg-white/[0.02] border rounded-xl p-5 transition-all ${
                    phase.status === "done"
                      ? "border-emerald-500/20 bg-emerald-500/[0.03]"
                      : "border-white/[0.06] hover:border-white/10"
                  }`}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center space-x-2 mb-1">
                        <span className="text-[10px] font-mono text-gray-600 bg-white/[0.04] px-2 py-0.5 rounded">
                          P{phase.id}
                        </span>
                        <h3 className="text-base font-bold text-white">{phase.title}</h3>
                      </div>
                      <div className="flex items-center space-x-3 text-xs text-gray-500">
                        <span>{phase.date}</span>
                        <span>·</span>
                        <span className="text-gray-400">{phase.owner}</span>
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded ${
                        phase.status === "done"
                          ? "bg-emerald-500/10 text-emerald-400"
                          : phase.status === "active"
                            ? "bg-blue-500/10 text-blue-400"
                            : "bg-white/[0.04] text-gray-600"
                      }`}
                    >
                      {phase.status === "done" ? "Complete" : phase.status === "active" ? "In progress" : "Upcoming"}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {phase.items.map((item, j) => (
                      <span
                        key={j}
                        className="text-[11px] font-mono text-gray-500 bg-white/[0.03] border border-white/[0.04] px-2.5 py-1 rounded-md"
                      >
                        {item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
