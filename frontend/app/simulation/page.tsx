import type { Metadata } from "next";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import SimulationConsole from "@/components/simulation/SimulationConsole";
import sim from "@/data/network-sim.json";

export const metadata: Metadata = {
  title: "Attack simulation — EVNet Sentinel",
  description:
    "Launch a real attack class across the CICEVSE2024 charging-station testbed and watch a detector call it, packet by packet.",
};

export default function SimulationPage() {
  return (
    <main className="dashboard-surface min-h-screen bg-[#020617]">
      <Navbar />
      <div className="mx-auto max-w-[92rem] px-6 pb-20 pt-28">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-white text-balance">
            Launch an attack. Watch a detector call it.
          </h1>
          <p className="mt-3 max-w-3xl text-[15px] leading-relaxed text-slate-400">
            The topology is the CICEVSE2024 testbed, transcribed from the dataset&rsquo;s own device
            table. Every packet is a held-out flow and every verdict is a real model output — so when
            a reconnaissance scan slips past, that is the detector genuinely failing, not a scripted
            beat.
          </p>
          <p className="mt-2 max-w-3xl text-[13px] leading-relaxed text-slate-500">
            {sim.benignNote}
          </p>
        </header>
        <SimulationConsole sim={sim as never} />
      </div>
      <Footer />
    </main>
  );
}
