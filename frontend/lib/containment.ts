/**
 * Site threat level and containment recommendations — the TypeScript twin of
 * src/response/containment.py. Both read data/containment-policy.json;
 * tests/test_containment.py checks the rules on the same held-out flows the
 * simulation console uses, and src/evaluation/replay_response.py measures them.
 *
 * Simulated: Sentinel is a passive mirror-port IDS. Every action is a
 * recommendation an operator approves. "quarantine" and "restrict" model a
 * switch ACL; "end-session" models the charger stopping a session and refusing
 * the vehicle. Sentinel itself never blocks traffic.
 */
import policyJson from "@/data/containment-policy.json";

export type Level = "safe" | "elevated" | "unsafe";
export const LEVELS: Level[] = ["safe", "elevated", "unsafe"];
export type Category = "dos" | "recon" | "benign";
export type Action = "quarantine" | "restrict" | "end-session";
export type Reason = "flood" | "scan" | "escalation";

export type Observation = {
  flagged: boolean;
  category: Category;
  confidence: number | null;
  sender: string | null;
};

export type Recommendation = { sender: string; action: Action; reason: Reason };

export type Policy = typeof policyJson;
export const POLICY: Policy = policyJson;

export type SiteState = {
  window: Observation[];
  level: Level;
  calm: number;
  /** sender -> the action an operator approved */
  contained: Record<string, Action>;
  /** senders that have scanned the site; they escalate at a lower bar */
  watched: string[];
  recommendation: Recommendation | null;
};

export const initialState: SiteState = {
  window: [], level: "safe", calm: 0, contained: {}, watched: [], recommendation: null,
};

export const containedSenders = (s: SiteState) => Object.keys(s.contained);

export const flaggedShare = (s: SiteState) =>
  s.window.length ? s.window.filter((o) => o.flagged).length / s.window.length : 0;

function targetLevel(win: Observation[], p: Policy): Level {
  if (win.length < p.minFlows) return "safe";
  const share = win.filter((o) => o.flagged).length / win.length;
  if (share >= p.unsafeShare) return "unsafe";
  if (share >= p.elevatedShare) return "elevated";
  return "safe";
}

type Rule = { categories: string[]; minDetections: number; minConfidence?: number };

function counts(win: Observation[], rule: Rule, contained: Record<string, Action>, p: Policy) {
  const out = new Map<string, number>();
  for (const o of win) {
    if (o.flagged && o.sender && rule.categories.includes(o.category)
        && (o.confidence ?? 0) >= (rule.minConfidence ?? 0)
        && !p.protected.includes(o.sender) && !(o.sender in contained)) {
      out.set(o.sender, (out.get(o.sender) ?? 0) + 1);
    }
  }
  return out;
}

function top(c: Map<string, number>, need: number) {
  let best: [string, number] | null = null;
  for (const e of c) if (!best || e[1] > best[1]) best = e;
  return best && best[1] >= need ? best[0] : null;
}

function recommend(win: Observation[], level: Level, s: SiteState, p: Policy): Recommendation | null {
  // 1. Escalation: a device that scanned earlier is now attacking.
  const esc = new Map([...counts(win, p.escalate, s.contained, p)].filter(([k]) => s.watched.includes(k)));
  let sender = top(esc, p.escalate.minDetections);
  if (sender) return { sender, action: "quarantine", reason: "escalation" };
  // 2. A confident flood while the site is unsafe.
  if (level === "unsafe") {
    sender = top(counts(win, p.quarantine, s.contained, p), p.quarantine.minDetections);
    if (sender) return { sender, action: "quarantine", reason: "flood" };
  }
  // 3. A device scanning the site.
  if (LEVELS.indexOf(level) >= LEVELS.indexOf(p.restrict.minLevel as Level)) {
    sender = top(counts(win, p.restrict, s.contained, p), p.restrict.minDetections);
    if (sender) return { sender, action: p.vehicles.includes(sender) ? "end-session" : "restrict", reason: "scan" };
  }
  return null;
}

export function observe(s: SiteState, o: Observation, p: Policy = POLICY): SiteState {
  const win = [...s.window, o].slice(-p.window);
  const target = targetLevel(win, p);
  let { level, calm } = s;
  if (LEVELS.indexOf(target) >= LEVELS.indexOf(level)) { level = target; calm = 0; }
  else if (++calm >= p.cooldownFlows) { level = target; calm = 0; }
  const recommendation = recommend(win, level, s, p);
  const watched = recommendation?.reason === "scan" && !s.watched.includes(recommendation.sender)
    ? [...s.watched, recommendation.sender] : s.watched;
  return { ...s, window: win, level, calm, watched, recommendation };
}

export function approve(s: SiteState, sender: string, action?: Action, p: Policy = POLICY): SiteState {
  if (p.protected.includes(sender)) return s; // site infrastructure is never cut off
  const rec = s.recommendation;
  const chosen = action ?? (rec && rec.sender === sender ? rec.action : "quarantine");
  return { ...s, contained: { ...s.contained, [sender]: chosen }, recommendation: null };
}

export function release(s: SiteState, sender: string): SiteState {
  const contained = { ...s.contained };
  delete contained[sender];
  return { ...s, contained };
}
