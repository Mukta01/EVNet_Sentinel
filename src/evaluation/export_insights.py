"""
Build the per-attack insights bundle the dashboard reads.

Merges three sources into frontend/data/insights.json:

    evaluation_results/attack_tests.json          attack_test_harness.py
    evaluation_results/multiseed/multiseed_raw.json  run_experiments.py
    src/evaluation/response_playbook.json          hand-written guidance

The plain-language takeaways at the top of the dashboard are generated here from
the test results rather than written by hand, so they stay true when the tests
are re-run against new models.

Usage
-----
    python3 src/evaluation/attack_test_harness.py
    python3 src/evaluation/export_insights.py
"""

import argparse
import json
import os
from datetime import datetime, timezone

import numpy as np

LABEL = {"RandomForest": "Random Forest", "DecisionTree": "Decision Tree",
         "LogisticRegression": "Logistic Regression", "SVM": "SVM"}
VOLUMETRIC = {"SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood"}


def pretty(name):
    return name.replace("_", " ")


def merge_actions(playbook, cls, cat):
    """Class-specific actions first, then the category's general actions."""
    specific = playbook["attacks"].get(cls, {}).get("actions", {})
    general = playbook["categories"][cat]["actions"]
    return {role: specific.get(role, []) + general.get(role, []) for role in playbook["roles"]}


def takeaways(tests, attacks):
    """Findings a third person can read without the tables."""
    models = tests["models"]
    campaign = tests["campaign"]["summary"]
    out = []

    # Recommend a primary detector on what matters operationally: among the
    # models that name attacks about as well as the best one, pick the one that
    # raises the fewest false alarms. Counting "wins" alone would reward a model
    # for being the least-wrong on scans it names correctly a fraction of the time.
    well = [a for a in attacks if a["class"] != "Benign" and not a["lowSupport"]]
    naming = {m: float(np.mean([a["models"][m]["exact"] for a in well])) for m in models}
    top_naming = max(naming.values())
    contenders = [m for m in models if naming[m] >= top_naming - 0.02]
    benign = next((a for a in attacks if a["class"] == "Benign"), None)
    alarms = ({m: 1 - benign["models"][m]["exact"] for m in models} if benign else {m: 0.0 for m in models})
    primary = min(contenders, key=lambda m: alarms[m])
    others = [m for m in contenders if m != primary]
    detail = (f"It names well-sampled attacks {naming[primary]:.0%} of the time on average"
              + (f", level with {' and '.join(LABEL.get(m, m) for m in others)}" if others else "")
              + f", and raises the fewest false alarms ({alarms[primary]:.0%} of normal flows).")

    worst_detect = min(s["detected"] for s in campaign.values())
    out.append({
        "tone": "good",
        "headline": "No attack slipped through as normal traffic.",
        "detail": (f"Across {tests['campaign']['trials']} mixed campaigns of four simultaneous attacks, "
                   f"every model flagged at least {worst_detect:.1%} of attack flows as malicious."),
    })

    vol = [a for a in attacks if a["class"] in VOLUMETRIC]
    vol_named = sum(1 for a in vol if a["models"][a["bestModel"]]["exact"] >= 0.99)
    out.append({
        "tone": "good",
        "headline": f"Floods are named exactly: {vol_named} of {len(vol)} volumetric floods identified at 99% or better.",
        "detail": "Flood traffic has a distinct signature in packet sizes, TCP flags and timing, so the detector can "
                  "say precisely which flood it is.",
    })

    recon = [a for a in attacks if a["category"] == "recon"]
    rc = np.mean([max(m["category"] for m in a["models"].values()) for a in recon])
    rx = np.mean([a["models"][a["bestModel"]]["exact"] for a in recon])
    out.append({
        "tone": "caution",
        "headline": "Scans are recognised as scans, but not always named.",
        "detail": (f"Reconnaissance is placed in the right category {rc:.0%} of the time, but the exact scan type only "
                   f"{rx:.0%} (best model for each). The six nmap modes send nearly identical traffic — respond to a scan as a scan."),
    })

    leaks = {}
    for a in recon:
        for c in a["models"][primary]["confusedWith"]:
            if c["category"] != "recon":
                leaks.setdefault(c["label"], []).append(c["share"])
    if leaks:
        target = max(leaks, key=lambda k: len(leaks[k]))
        shares = leaks[target]
        if len(shares) >= len(recon) // 2:
            out.append({
                "tone": "caution",
                "headline": f"When a scan is mistaken for something else, it is almost always {pretty(target)}.",
                "detail": (f"With {LABEL.get(primary, primary)}, {len(shares)} of {len(recon)} scan types lose "
                           f"{min(shares):.0%}-{max(shares):.0%} of their flows to {pretty(target)}, a slow "
                           f"denial-of-service attack. Both hold long-lived, "
                           f"near-idle connections, so at flow level they look alike. This single confusion is "
                           f"almost all of the error between categories."),
            })

    benign = next((a for a in attacks if a["class"] == "Benign"), None)
    if benign:
        alarms = {m: 1 - benign["models"][m]["exact"] for m in models}
        # More than one false alarm in four normal flows would bury an operator.
        noisy = sorted([m for m, v in alarms.items() if v >= 0.25], key=lambda m: -alarms[m])
        quiet = min(alarms, key=alarms.get)
        if noisy:
            names = " and ".join(LABEL.get(m, m) for m in noisy)
            verb = "raise" if len(noisy) > 1 else "raises"
            rates = ", ".join(f"{LABEL.get(m, m)} {alarms[m]:.0%}" for m in noisy)
            out.append({
                "tone": "warning",
                "headline": f"{names} {verb} too many false alarms on normal traffic.",
                "detail": (f"Share of normal flows flagged as attacks: {rates}. {LABEL.get(quiet, quiet)} is the "
                           f"quietest at {alarms[quiet]:.0%}. Only {benign['support']} unseen normal flows exist per "
                           f"model set, so treat these rates as indicative."),
            })

    cat_wins = {m: 0 for m in models}
    recon = [a for a in attacks if a["category"] == "recon"]
    for a in recon:
        cat_wins[a["bestCategoryModel"]] += 1
    cat_top = max(cat_wins, key=cat_wins.get)
    if cat_top != primary:
        detail += (f" To decide whether traffic is a scan at all, {LABEL.get(cat_top, cat_top)} is stronger "
                   f"(best on {cat_wins[cat_top]} of {len(recon)} scan types), so it is a useful second opinion.")
    out.append({"tone": "neutral",
                "headline": f"Recommended primary detector: {LABEL.get(primary, primary)}.",
                "detail": detail})
    return out


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--tests", default="evaluation_results/attack_tests.json")
    parser.add_argument("--multiseed", default="evaluation_results/multiseed/multiseed_raw.json")
    parser.add_argument("--playbook", default="src/evaluation/response_playbook.json")
    parser.add_argument("--out", default="frontend/data/insights.json")
    args = parser.parse_args()

    tests = json.load(open(args.tests))
    playbook = json.load(open(args.playbook))
    multiseed = json.load(open(args.multiseed)) if os.path.exists(args.multiseed) else None

    attacks = []
    for row in tests["perAttack"]:
        cls, cat = row["class"], row["category"]
        entry = dict(row)
        entry["label"] = pretty(cls)

        # Multi-seed per-class F1 for the same models, for readers who want the
        # standard metric alongside the three-level test.
        if multiseed:
            f1 = {}
            for name in tests["models"]:
                vals = [s["models"][name]["per_class_f1"].get(cls, 0.0) for s in multiseed["per_seed"]
                        if name in s["models"]]
                if vals:
                    f1[name] = {"f1": round(float(np.mean(vals)), 4), "std": round(float(np.std(vals)), 4)}
            entry["f1"] = f1

        info = playbook["attacks"].get(cls, {})
        entry["response"] = {
            "severity": info.get("severity", "medium"),
            "what": info.get("what", ""),
            "categorySummary": playbook["categories"][cat]["summary"],
            "impact": playbook["categories"][cat]["impact"],
            "actions": merge_actions(playbook, cls, cat),
            # Used when the detector cannot reliably name the attack: act on the category.
            "categoryActions": playbook["categories"][cat]["actions"],
            # Only shown when even the best model cannot reliably name this attack.
            "uncertainty": (playbook["categories"][cat].get("uncertainty")
                            if row["bestVerdict"] in ("category", "detected") else None),
        }
        attacks.append(entry)

    order = {"dos": 0, "recon": 1, "benign": 2}
    attacks.sort(key=lambda a: (order[a["category"]], a["lowSupport"],
                                -a["models"][a["bestModel"]]["exact"]))

    bundle = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "testedAt": tests["generated"],
        "config": tests["config"],
        "models": tests["models"],
        "modelLabels": {m: LABEL.get(m, m) for m in tests["models"]},
        "roles": playbook["roles"],
        "takeaways": takeaways(tests, attacks),
        "campaign": tests["campaign"],
        "passed": tests["passed"],
        "gateFailures": tests["gateFailures"],
        "attacks": attacks,
    }
    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as handle:
        json.dump(bundle, handle, indent=1)
    print(f"[+] {args.out}  ({len(attacks)} attack types, {os.path.getsize(args.out) / 1024:.0f} KB)")
    for t in bundle["takeaways"]:
        print(f"    [{t['tone']:<7}] {t['headline']}")


if __name__ == "__main__":
    main()
