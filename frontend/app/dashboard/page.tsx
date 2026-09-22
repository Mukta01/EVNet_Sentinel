import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardShell from "@/components/dashboard/DashboardShell";
import { promises as fs } from "fs";
import path from "path";

export const metadata: Metadata = {
  title: "Results — EVNet Sentinel",
  description:
    "Leakage-corrected intrusion detection results on CICEVSE2024, and a replay of held-out charging-network traffic through each trained model.",
};

export default async function DashboardPage() {
  const findingsRaw = await fs.readFile(path.join(process.cwd(), "data", "findings.json"), "utf8");
  const findings = JSON.parse(findingsRaw);
  const simulationRaw = await fs.readFile(path.join(process.cwd(), "data", "simulation.json"), "utf8");
  const simulation = JSON.parse(simulationRaw);

  return (
    <main className="dashboard-surface min-h-screen bg-[#020617]">
      <Navbar />
      <DashboardShell findings={findings} simulation={simulation} />
      <Footer />
    </main>
  );
}
