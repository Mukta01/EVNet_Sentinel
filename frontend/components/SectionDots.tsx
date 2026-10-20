"use client";

import DotGrid from "./DotGrid";
import { useTheme } from "./ThemeToggle";

/** A quiet React Bits DotGrid behind a run of sections; dots part around the cursor. */
export default function SectionDots({ children }: { children: React.ReactNode }) {
  const light = useTheme() === "light";
  return (
    <div className="relative">
      <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
        <DotGrid
          dotSize={3}
          gap={26}
          baseColor={light ? "#D6D3CB" : "#1E293B"}
          activeColor={light ? "#059669" : "#10B981"}
          proximity={120}
          glow={0.4}
          fade={0.6}
          opacity={0.8}
          clickShock={false}
        />
      </div>
      <div className="relative z-10">{children}</div>
    </div>
  );
}
