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
import { MODEL_LABEL } from "@/components/dashboard/theme";

/* eslint-disable @typescript-eslint/no-explicit-any */

const read = async (name: string) =>
  JSON.parse(await fs.readFile(path.join(process.cwd(), "data", name), "utf8"));

const VOLUMETRIC = new Set(["SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood"]);

/**
 * The hero's headline numbers come from the committed exports,
 * so the first screen shows measured results rather than hand-typed claims.
 */
async function heroData() {
  const insights = await read("insights.json");
  const findings = await read("findings.json");

  const primary: string = insights.primary ?? "RandomForest";
  const detector = MODEL_LABEL[primary] ?? primary;

  const rows: any[] = insights.attacks;
  const floods = rows.filter((a) => VOLUMETRIC.has(a.class));
  const scans = rows.filter((a) => a.category === "recon");
  const benign = rows.find((a) => a.class === "Benign");
  const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;
  const pct = (x: number) => `${Math.round(x * 100)}%`;
  const stats: HeroStat[] = [
    { value: pct(mean(floods.map((a) => a.models[a.bestModel].exact))), label: "Floods named exactly", sub: `${floods.length} flood types` },
    { value: pct(mean(scans.map((a) => Math.max(...Object.values(a.models).map((m: any) => m.category))))), label: "Scans recognised as scans", sub: "best model per scan" },
    { value: pct(1 - benign.models[primary].exact), label: "False alarms", sub: `${detector}, the primary detector` },
    { value: `${(findings.dataset.rows_after_dedup / 1e6).toFixed(1)}M`, label: "Flows analysed", sub: `${findings.dataset.n_classes} traffic classes` },
  ];
  return { stats };
}

export default async function Home() {
  const { stats } = await heroData();
  return (
    <main className="min-h-screen bg-[#020617]">
      <Navbar />
      <Hero stats={stats} />
      <Features />
      <ArchitectureStory />
      <TechStack />
      <Team />
      <Roadmap />
      <Footer />
    </main>
  );
}
