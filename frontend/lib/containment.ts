/**
 * Site threat level and quarantine recommendation — the TypeScript twin of
 * src/response/containment.py. Both read data/containment-policy.json, and
 * tests/test_containment.py replays the policy on the same held-out flows the
 * simulation console uses.
 *
 * Simulated: Sentinel is a passive mirror-port IDS. A quarantine here models a
 * switch ACL that an operator approves; Sentinel itself never blocks traffic.
 */
import policyJson from "@/data/containment-policy.json";

export type Level = "safe" | "elevated" | "unsafe";
export const LEVELS: Level[] = ["safe", "elevated", "unsafe"];
export type Category = "dos" | "recon" | "benign";

export type Observation = {
  flagged: boolean;
  category: Category;
  confidence: number | null;
  sender: string | null;
};

export type Policy = typeof policyJson;
export const POLICY: Policy = policyJson;

export type SiteState = {
  window: Observation[];
  level: Level;
  calm: number;
  quarantined: string[];
  recommendation: string | null;
};

export const initialState: SiteState = {
  window: [], level: "safe", calm: 0, quarantined: [], recommendation: null,
};

export const flaggedShare = (s: SiteState) =>
  s.window.length ? s.window.filter((o) => o.flagged).length / s.window.length : 0;

function targetLevel(win: Observation[], p: Policy): Level {
  if (win.length < p.minFlows) return "safe";
  const share = win.filter((o) => o.flagged).length / win.length;
  if (share >= p.unsafeShare) return "unsafe";
  if (share >= p.elevatedShare) return "elevated";
  return "safe";
}

function recommend(win: Observation[], level: Level, quarantined: string[], p: Policy) {
  if (level !== "unsafe") return null;
  const q = p.quarantine;
  const counts = new Map<string, number>();
  for (const o of win) {
    if (o.flagged && o.sender && q.categories.includes(o.category)
        && o.confidence !== null && o.confidence >= q.minConfidence
        && !p.protected.includes(o.sender) && !quarantined.includes(o.sender)) {
      counts.set(o.sender, (counts.get(o.sender) ?? 0) + 1);
    }
  }
  let best: [string, number] | null = null;
  for (const e of counts) if (!best || e[1] > best[1]) best = e;
  return best && best[1] >= q.minDetections ? best[0] : null;
}

export function observe(s: SiteState, o: Observation, p: Policy = POLICY): SiteState {
  const win = [...s.window, o].slice(-p.window);
  const target = targetLevel(win, p);
  let { level, calm } = s;
  if (LEVELS.indexOf(target) >= LEVELS.indexOf(level)) { level = target; calm = 0; }
  else if (++calm >= p.cooldownFlows) { level = target; calm = 0; }
  return { ...s, window: win, level, calm, recommendation: recommend(win, level, s.quarantined, p) };
}

export function approve(s: SiteState, sender: string, p: Policy = POLICY): SiteState {
  if (p.protected.includes(sender)) return s; // site infrastructure is never cut off
  return { ...s, quarantined: [...new Set([...s.quarantined, sender])], recommendation: null };
}

export function release(s: SiteState, sender: string): SiteState {
  return { ...s, quarantined: s.quarantined.filter((x) => x !== sender) };
}
