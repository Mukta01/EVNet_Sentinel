import Navbar from "@/components/Navbar";
import Hero from "@/components/Hero";
import Features from "@/components/Features";
import Architecture from "@/components/Architecture";
import TechStack from "@/components/TechStack";
import Team from "@/components/Team";
import Roadmap from "@/components/Roadmap";
import Footer from "@/components/Footer";

export default function Home() {
  return (
    <main className="min-h-screen bg-[#020617]">
      <Navbar />
      <Hero />
      <Features />
      <Architecture />
      <TechStack />
      <Team />
      <Roadmap />
      <Footer />
    </main>
  );
}
