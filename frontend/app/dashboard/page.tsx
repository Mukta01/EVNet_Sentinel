import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import DashboardShell from "@/components/dashboard/DashboardShell";
import findings from "@/data/findings.json";
import simulation from "@/data/simulation.json";

export const metadata: Metadata = {
  title: "Results — EVNet Sentinel",
  description:
    "Leakage-corrected intrusion detection results on CICEVSE2024, and a replay of held-out charging-network traffic through each trained model.",
};

export default function DashboardPage() {
  return (
    <main className="dashboard-surface min-h-screen bg-[#020617]">
      <Navbar />
      <DashboardShell findings={findings} simulation={simulation} />
      <Footer />
    </main>
  );
}
