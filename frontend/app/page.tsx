import { promises as fs } from "fs";
import path from "path";
import Navbar from "@/components/Navbar";
import Hero, { type HeroStat } from "@/components/Hero";
import Features from "@/components/Features";
import ArchitectureStory from "@/components/story/ArchitectureStory";
import TechStack from "@/components/TechStack";
import Team from "@/components/Team";
import Roadmap from "@/components/Roadmap";
import Footer from "@/components/Footer";
import type { DemoAttack } from "@/components/hero/BeatTheSentinel";

/* eslint-disable @typescript-eslint/no-explicit-any */

const read = async (name: string) =>
  JSON.parse(await fs.readFile(path.join(process.cwd(), "data", name), "utf8"));

const DEMO: [string, string, DemoAttack["category"]][] = [
  ["SYN_Flood", "SYN Flood", "dos"],
  ["UDP_Flood", "UDP Flood", "dos"],
  ["Slowloris_Scan", "Slowloris", "dos"],
  ["TCP_Port_Scan", "Port Scan", "recon"],
  ["SYN_Stealth_Scan", "Stealth Scan", "recon"],
  ["Vulnerability_Scan", "Vulnerability Scan", "recon"],
];
const VOLUMETRIC = new Set(["SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood"]);

/**
 * The hero's demo flows and headline numbers come from the committed exports,
 * so the first screen shows measured results rather than hand-typed claims.
 */
async function heroData() {
  const sim = await read("network-sim.json");
  const insights = await read("insights.json");
  const findings = await read("findings.json");
  const tuning = await read("hero.json");

  const rf = String(sim.models.indexOf("RandomForest"));
  const byId = new Map<number, any>(sim.flows.map((f: any) => [f.id, f]));
  const attacks: DemoAttack[] = DEMO.map(([cls, label, category]) => ({
    cls, label, category,
    flows: (sim.byClass[cls] ?? []).slice(0, 60).map((id: number) => {
      const v = byId.get(id).p[rf];
      return { id, called: v[0], confidence: v[3] ?? null };
    }),
  })).filter((a) => a.flows.length);

  const rows: any[] = insights.attacks;
  const floods = rows.filter((a) => VOLUMETRIC.has(a.class));
  const scans = rows.filter((a) => a.category === "recon");
  const benign = rows.find((a) => a.class === "Benign");
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const stats: HeroStat[] = [
    { value: pct(mean(floods.map((a) => a.models[a.bestModel].exact))), label: "Floods named exactly", sub: `${floods.length} flood types` },
    { value: pct(mean(scans.map((a) => Math.max(...Object.values(a.models).map((m: any) => m.category))))), label: "Scans recognised as scans", sub: "best model per scan" },
    { value: pct(1 - benign.models.RandomForest.exact), label: "False alarms", sub: "Random Forest" },
    { value: `${(findings.dataset.rows_after_dedup / 1e6).toFixed(1)}M`, label: "Flows analysed", sub: `${findings.dataset.n_classes} traffic classes` },
  ];
  return { attacks, tuning, stats };
}

export default async function Home() {
  const { attacks, tuning, stats } = await heroData();
  return (
    <main className="min-h-screen bg-[#020617]">
      <Navbar />
      <Hero attacks={attacks} tuning={tuning} stats={stats} />
      <Features />
      <ArchitectureStory />
      <TechStack />
      <Team />
      <Roadmap />
      <Footer />
    </main>
  );
}
