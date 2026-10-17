import { CheckCircle2, Paintbrush } from "lucide-react";

/**
 * Answers "why should I trust this simulation?" on the page itself: which parts
 * are measured data and model output, and which parts are only presentation.
 */
const REAL = [
  "Every flow is a recorded flow from CICEVSE2024 (Canadian Institute for Cybersecurity testbed).",
  "Every flow is held out: no model was trained on it.",
  "Every verdict and confidence is that model's actual output, computed offline from the same files the API serves.",
  "Who attacked which station comes from the MAC addresses inside each flow, not from guesswork.",
  "The threat-level and quarantine rules are tested on these same flows (tests/test_containment.py).",
];
const VISUAL = [
  "Packet animation and wire speed: a display setting, not the attack's real timing.",
  "Normal traffic loops over the 12 held-out benign flows the dataset has.",
  "The quarantine is a simulated switch block an operator approves. Sentinel itself is passive and blocks nothing.",
];

export default function WhatsReal() {
  return (
    <details className="group mt-5 max-w-4xl rounded-lg border border-white/8 bg-white/[0.02]">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-4 py-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 [&::-webkit-details-marker]:hidden">
        <span className="text-slate-200">
          <span className="font-medium">What&rsquo;s real here?</span>
          <span className="text-slate-500"> A replay of recorded attacks, not invented traffic.</span>
        </span>
        <span className="shrink-0 text-xs text-slate-500 group-open:hidden">Show</span>
        <span className="hidden shrink-0 text-xs text-slate-500 group-open:inline">Hide</span>
      </summary>
      <div className="grid gap-6 border-t border-white/8 px-4 py-4 sm:grid-cols-2">
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />Measured
          </h3>
          <ul className="space-y-1.5 text-[13px] leading-snug text-slate-300">
            {REAL.map((t) => <li key={t}>{t}</li>)}
          </ul>
        </div>
        <div>
          <h3 className="mb-2 flex items-center gap-1.5 text-[11px] uppercase tracking-[0.14em] text-sky-300">
            <Paintbrush className="h-3.5 w-3.5" aria-hidden />Presentation only
          </h3>
          <ul className="space-y-1.5 text-[13px] leading-snug text-slate-300">
            {VISUAL.map((t) => <li key={t}>{t}</li>)}
          </ul>
          <p className="mt-3 text-[12px] leading-snug text-slate-500">
            Why replay at all: attacking live charging stations is unsafe and illegal, and only
            recorded traffic has ground truth, so we can tell whether a verdict was right.
          </p>
        </div>
      </div>
    </details>
  );
}
