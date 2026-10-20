"""
Replay the recorded attacks through the containment policy and measure what
the closed loop would have stopped.

For every attack class and every device that really sent it (from the capture
routes), this streams a short benign baseline and then that device's held-out
flows mixed with normal traffic, through the primary detector's recorded
verdicts and src/response/containment.py. A simulated operator approves each
recommendation a few flows after it appears. Once a device is contained, the
switch (or, for a vehicle, the charger) drops its attack traffic before it
reaches the station.

Per class and device it reports which action was recommended, how many attack
flows reached the station before containment took effect, and how many were
stopped after. A recon-then-flood campaign measures escalation: how much
sooner a device that scanned first is quarantined once it starts flooding.

This is a replay of recorded traffic through the policy, not live blocking:
Sentinel is a passive IDS and no switch was reconfigured. The verdicts are the
ones in frontend/data/network-sim.json (one held-out split), so the counts
show how the policy behaves on real detector output, with small samples for
some classes.

Writes frontend/data/response-replay.json and
evaluation_results/response/response_replay.json.

Usage
-----
    python3 src/evaluation/replay_response.py
"""

import argparse
import json
import os
import random
import sys
from statistics import mean

sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", ".."))
from src.response.containment import Observation, SiteState, load_policy  # noqa: E402

DATA = os.path.join("frontend", "data")


def category(group):
    return "recon" if group == "recon" else "benign" if group == "benign" else "dos"


class Replay:
    def __init__(self, sim, routes, model, policy):
        self.flows = {f["id"]: f for f in sim["flows"]}
        self.by_class = sim["byClass"]
        self.routes = routes
        self.col = str(sim["models"].index(model))
        self.policy = policy

    def sender_of(self, flow):
        return self.routes.get(flow["capture"], {}).get("sender") if flow["trueLabel"] != "Benign" else None

    def pool(self, cls, sender=None):
        return [i for i in self.by_class[cls] if sender is None or self.sender_of(self.flows[i]) == sender]

    def observation(self, flow_id):
        flow = self.flows[flow_id]
        label, group, _, confidence, *_ = flow["p"][self.col] + [None] * 2
        return Observation(label != "Benign", category(group), confidence, self.sender_of(flow))

    def run(self, steps, delay, state=None):
        """steps: flow ids in order. Returns per-step outcomes and the final state."""
        state = state or SiteState(self.policy)
        pending = None          # (recommendation, flows until the operator approves)
        log = []
        for flow_id in steps:
            obs = self.observation(flow_id)
            attack = self.flows[flow_id]["trueLabel"] != "Benign"
            if attack and obs.sender in state.contained:
                log.append(("blocked", None))
                continue
            state.observe(obs)
            rec = state.recommendation
            if rec and (pending is None or pending[0].sender != rec.sender or pending[0].action != rec.action):
                pending = [rec, delay]
            log.append(("reached" if attack else "benign", rec))
            if pending:
                pending[1] -= 1
                if pending[1] <= 0:
                    state.approve(pending[0].sender, pending[0].action)
                    pending = None
        return log, state


def mixed(rng, attack_pool, benign_pool, n, attack_share):
    out, a, b = [], 0, 0
    for _ in range(n):
        if rng.random() < attack_share:
            out.append(attack_pool[a % len(attack_pool)]); a += 1
        else:
            out.append(benign_pool[b % len(benign_pool)]); b += 1
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--flows", type=int, default=120, help="Flows per scenario after the baseline")
    parser.add_argument("--baseline", type=int, default=20, help="Benign flows before the attack starts")
    parser.add_argument("--attack-share", type=float, default=0.7)
    parser.add_argument("--delay", type=int, default=5, help="Flows between a recommendation and the operator's approval")
    parser.add_argument("--runs", type=int, default=20, help="Random interleavings per scenario")
    args = parser.parse_args()

    sim = json.load(open(os.path.join(DATA, "network-sim.json")))
    routes = json.load(open(os.path.join(DATA, "attack-routes.json")))["captures"]
    model = json.load(open(os.path.join(DATA, "insights.json")))["primary"]
    policy = load_policy()
    replay = Replay(sim, routes, model, policy)
    benign = replay.pool("Benign")

    scenarios = []
    for cls in sorted(sim["byClass"]):
        if cls == "Benign":
            continue
        senders = sorted({replay.sender_of(replay.flows[i]) for i in sim["byClass"][cls]} - {None})
        for sender in senders:
            pool = replay.pool(cls, sender)
            runs = []
            for seed in range(args.runs):
                rng = random.Random(seed)
                steps = benign * (args.baseline // len(benign) + 1)
                steps = steps[:args.baseline] + mixed(rng, pool, benign, args.flows, args.attack_share)
                log, state = replay.run(steps, args.delay)
                kinds = [k for k, _ in log]
                first = next((i for i, (_, r) in enumerate(log) if r and r.sender == sender), None)
                rec = next((r for _, r in log if r and r.sender == sender), None)
                runs.append({
                    "recommended": rec is not None,
                    "action": rec.action if rec else None,
                    "reason": rec.reason if rec else None,
                    "attackFlowsToRecommend": None if first is None else sum(k != "benign" for k in kinds[:first + 1]),
                    "reached": kinds.count("reached"),
                    "blocked": kinds.count("blocked"),
                    "contained": state.contained.get(sender),
                })
            total = [r["reached"] + r["blocked"] for r in runs]
            to_rec = [r["attackFlowsToRecommend"] for r in runs if r["attackFlowsToRecommend"] is not None]
            actions = sorted({r["action"] for r in runs if r["action"]})
            scenarios.append({
                "class": cls,
                "category": category(replay.flows[pool[0]]["trueGroup"]),
                "sender": sender,
                "heldOutFlows": len(pool),
                "smallSample": len(pool) < 30,   # flows are replayed in a loop, so read with care
                "recommendedShare": round(mean(r["recommended"] for r in runs), 3),
                "actions": actions,
                "attackFlowsToRecommend": round(mean(to_rec), 1) if to_rec else None,
                "reachedMean": round(mean(r["reached"] for r in runs), 1),
                "blockedMean": round(mean(r["blocked"] for r in runs), 1),
                "blockedShare": round(mean(r["blocked"] / t for r, t in zip(runs, total) if t), 3),
            })
            print(f"[*] {cls:<26} {sender:<5} action={','.join(actions) or '-':<12} "
                  f"stopped {scenarios[-1]['blockedShare']:.0%}  (after ~{scenarios[-1]['attackFlowsToRecommend']} attack flows)")

    # Escalation: the same laptop scans first, then floods. Compare with a cold flood.
    def flood_to_quarantine(warm):
        state = SiteState(policy)
        replay.run(benign * 2, args.delay, state)
        if warm:
            scan = replay.pool("TCP_Port_Scan", "kali")
            for i in range(60):
                state.observe(replay.observation(scan[i % len(scan)]))
            state.recommendation = None        # the operator did not act on the restriction
        flood = replay.pool("SYN_Flood", "kali")
        for n in range(1, 201):
            state.observe(replay.observation(flood[(n - 1) % len(flood)]))
            r = state.recommendation
            if r and r.action == "quarantine":
                return n, r.reason
        return None, None

    cold_n, _ = flood_to_quarantine(False)
    warm_n, warm_reason = flood_to_quarantine(True)

    # Normal traffic alone never triggers an action.
    state = SiteState(policy)
    recs = 0
    for i in range(2000):
        state.observe(replay.observation(benign[i % len(benign)]))
        recs += state.recommendation is not None

    stopped = [s for s in scenarios if s["recommendedShare"] > 0]
    out = {
        "generated_by": "src/evaluation/replay_response.py",
        "about": ("Recorded attacks replayed through the containment policy with the primary detector's "
                  "verdicts. A simulated operator approves each recommendation after a short delay. "
                  "A replay of recorded traffic, not live blocking."),
        "model": model,
        "settings": {"baselineFlows": args.baseline, "flowsPerScenario": args.flows,
                     "attackShare": args.attack_share, "approvalDelayFlows": args.delay, "runs": args.runs},
        "summary": {
            "scenarios": len(scenarios),
            "contained": len(stopped),
            "meanBlockedShare": round(mean(s["blockedShare"] for s in scenarios), 3),
            "escalation": {"coldFloodFlowsToQuarantine": cold_n, "afterScanFlowsToQuarantine": warm_n,
                           "reason": warm_reason},
            "benignOnly": {"flows": 2000, "recommendations": recs},
        },
        "scenarios": scenarios,
    }
    os.makedirs(os.path.join("evaluation_results", "response"), exist_ok=True)
    for path in (os.path.join(DATA, "response-replay.json"),
                 os.path.join("evaluation_results", "response", "response_replay.json")):
        with open(path, "w") as handle:
            json.dump(out, handle, indent=1)
        print(f"[+] {path}")
    print(f"[*] contained {len(stopped)}/{len(scenarios)} scenarios; mean attack traffic stopped "
          f"{out['summary']['meanBlockedShare']:.0%}; escalation {cold_n} -> {warm_n} flows; "
          f"benign-only recommendations {recs}")


if __name__ == "__main__":
    main()
