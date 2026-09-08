import type { Metadata } from "next";
import Link from "next/link";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import Architecture from "@/components/Architecture";

export const metadata: Metadata = {
  title: "Architecture — EVNet Sentinel",
  description:
    "The full system architecture for EVNet Sentinel: data layer, ML engine, serving API and dashboard.",
};

/**
 * The detailed architecture diagram lives here.
 *
 * The landing page tells the same story as a narrative (components/Storyline.tsx),
 * which is more persuasive but deliberately less complete. This page keeps the
 * component-level detail for anyone who wants it.
 */
export default function DocsPage() {
  return (
    <main className="dashboard-surface min-h-screen bg-[#020617]">
      <Navbar />
      <div className="mx-auto max-w-6xl px-6 pt-28">
        <h1 className="text-3xl font-semibold tracking-tight text-white text-balance sm:text-4xl">
          System architecture
        </h1>
        <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-slate-400">
          Component-level detail behind the pipeline. For the narrative version — where the system
          sits and why — see the <Link href="/#architecture" className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 hover:decoration-emerald-400">storyline on the home page</Link>.
          For measured results, see the <Link href="/dashboard" className="text-emerald-400 underline decoration-emerald-400/40 underline-offset-4 hover:decoration-emerald-400">findings dashboard</Link>.
        </p>
      </div>
      <Architecture />
      <Footer />
    </main>
  );
}
