"""
Attack-by-attack test harness: does the system catch each attack, and can it name it?

Run it whenever the models or the pipeline change. For every attack class it draws
repeated random batches of held-out flows, pushes them through every trained
detector, and scores each verdict at three levels:

    detected      flagged as malicious at all (not called Benign)
    category      placed in the right response category (DoS vs reconnaissance)
    exact         named as the exact attack class

The three levels exist because they fail differently and call for different
action. A port scan reported as an aggressive scan is still a scan, and the
right response is the same; a port scan waved through as benign is a genuine
miss. Collapsing everything into one accuracy figure hides that distinction,
and it is the distinction an operator needs.

It also checks the reverse failure -- benign traffic raising a false alarm --
and a mixed-campaign scenario where several attacks run at once.

Exit status is non-zero if any regression threshold fails, so it can gate CI or
a release.

Usage
-----
    python3 src/evaluation/attack_test_harness.py
    python3 src/evaluation/attack_test_harness.py --trials 50 --batch 100 --seed 7
    python3 src/evaluation/attack_test_harness.py --json-out frontend/data/attack-tests.json
"""

import argparse
import json
import os
import sys
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

MODEL_FILES = {
    "RandomForest": "rf_model_multiclass.pkl",
    "DecisionTree": "dt_model_multiclass.pkl",
    "LogisticRegression": "logreg_model_multiclass.pkl",
    "SVM": "svm_model_multiclass.pkl",
}

# Response category: what an operator acts on. Every flood, including the
# low-volume ICMP variants and Slowloris, is a denial-of-service attack whatever
# its detection difficulty; every nmap mode is reconnaissance.
DOS = {"SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood",
       "ICMP_Flood", "ICMP_Fragmentation", "Slowloris_Scan"}
RECON = {"TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection",
         "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"}
BENIGN = "Benign"


def category(label):
    if label in DOS:
        return "dos"
    if label in RECON:
        return "recon"
    return "benign"


# Verdict thresholds, applied to the mean over trials.
RELIABLE = 0.90
# Exact-rate gap within which two models count as tied for best.
TIE = 0.01

# Regression gates. Deliberately set at what the corrected models achieve today,
# so a change that makes things worse fails loudly -- not at what we wish they
# achieved. Reconnaissance exact-class accuracy is NOT gated: the audit showed it
# is limited by the data, and gating it would only produce a permanently red build.
GATES = {
    "volumetric_exact": 0.95,   # each volumetric flood named exactly by at least one model
    "attack_detected": 0.95,    # each attack (>=100 flows) flagged as malicious by at least one model
    "recon_category": 0.85,     # each scan recognised as reconnaissance by at least one model
}
# Floors carry margin below today's values (weakest recon category is ~0.89) so
# random-draw noise does not flap the build; a real regression still trips them.
VOLUMETRIC = {"SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood"}


def verdict_for(detected, cat, exact, benign=False):
    """Plain-language grade for one (attack, model) pair."""
    if benign:
        # For benign traffic the failure mode is a false alarm, not a miss.
        return "clean" if exact >= RELIABLE else "false-alarm"
    if exact >= RELIABLE:
        return "identified"       # names the exact attack
    if cat >= RELIABLE:
        return "category"         # knows the kind of attack, not which one
    if detected >= RELIABLE:
        return "detected"         # knows something is wrong, not what
    return "missed"


def ci95(values):
    arr = np.asarray(values, dtype=float)
    if len(arr) < 2:
        return float(arr.mean()), 0.0
    return float(arr.mean()), float(1.96 * arr.std(ddof=1) / np.sqrt(len(arr)))


def load(data_dir, models_dir):
    X = pd.read_csv(os.path.join(data_dir, "X_test.csv"))
    y = pd.read_csv(os.path.join(data_dir, "y_test.csv"))["Label_Multiclass"].to_numpy()

    # Refuse to test against a leaked dataset: every number would be meaningless.
    leaking = [c for c in X.columns if c.endswith("_seen_ms") or c == "src_port"]
    if leaking:
        raise SystemExit(f"Leaking columns in {data_dir}: {leaking}. Regenerate with: make data-process")

    models = {}
    for name, filename in MODEL_FILES.items():
        path = os.path.join(models_dir, filename)
        if os.path.exists(path):
            models[name] = joblib.load(path)
        else:
            print(f"[!] {path} not found -- {name} skipped")
    if not models:
        raise SystemExit(f"No trained models in {models_dir}")
    return X, y, models


def load_runs(args):
    """
    One run per seed: that seed's trained models scored on that seed's own
    held-out split. Testing across seeds means a verdict has to hold up across
    different training runs, not just different draws from one model.
    """
    runs = []
    for seed in args.seeds:
        data_dir = os.path.join(args.multiseed_data, f"seed-{seed}")
        models_dir = os.path.join(args.multiseed_models, f"seed-{seed}")
        if not (os.path.isdir(data_dir) and os.path.isdir(models_dir)):
            print(f"[!] seed {seed}: {data_dir} or {models_dir} missing -- skipped")
            continue
        X, y, models = load(data_dir, models_dir)
        preds = {}
        for name, model in models.items():
            preds[name] = np.asarray(model.predict(X))
        runs.append({"seed": seed, "y": y, "pred": preds})
        print(f"[*] seed {seed}: {len(y):,} held-out flows, {len(models)} detectors")
    if not runs:
        raise SystemExit("No seed runs found. Run src/evaluation/run_experiments.py first.")
    return runs


def run(args):
    started = time.perf_counter()
    runs = load_runs(args)
    models = list(runs[0]["pred"])
    for r in runs:
        r["pcat"] = {n: np.vectorize(category)(p) for n, p in r["pred"].items()}
        r["tcat"] = np.vectorize(category)(r["y"])

    rng = np.random.RandomState(args.seed)
    per_attack = []
    classes = sorted(set().union(*[set(r["y"]) for r in runs]))
    for cls in classes:
        pools = {r["seed"]: np.flatnonzero(r["y"] == cls) for r in runs}
        support = int(np.mean([len(p) for p in pools.values()]))
        n = min(args.batch, support)
        # Small classes cannot supply fresh batches, so draw with replacement
        # and flag the result as low-support rather than pretend otherwise.
        replace = support < args.batch

        row = {"class": cls, "category": category(cls), "support": support,
               "lowSupport": bool(support < 100), "batch": int(n),
               "trials": args.trials * len(runs), "models": {}}
        for name in models:
            det, cat, exact, wrong = [], [], [], []
            for r in runs:
                pool = pools[r["seed"]]
                if not len(pool):
                    continue
                p, pc, tc = r["pred"][name], r["pcat"][name], r["tcat"]
                for _ in range(args.trials):
                    d = rng.choice(pool, min(n, len(pool)) if not replace else n, replace=replace)
                    if cls == BENIGN:
                        ok = np.mean(p[d] == BENIGN)
                        det.append(ok); cat.append(ok); exact.append(ok)
                    else:
                        det.append(np.mean(p[d] != BENIGN))
                        cat.append(np.mean(pc[d] == tc[d]))
                        exact.append(np.mean(p[d] == cls))
                wrong.extend(p[pool][p[pool] != cls])

            (dm, dci), (cm, cci), (em, eci) = ci95(det), ci95(cat), ci95(exact)

            # What it gets called instead, across every flow of this class and seed.
            total = sum(len(p) for p in pools.values())
            confused = []
            if wrong:
                vals, counts = np.unique(np.asarray(wrong), return_counts=True)
                for v, c in sorted(zip(vals, counts), key=lambda t: -t[1])[:3]:
                    confused.append({"label": str(v), "category": category(v),
                                     "share": round(float(c) / total, 4)})

            row["models"][name] = {
                "detected": round(dm, 4), "detectedCI": round(dci, 4),
                "category": round(cm, 4), "categoryCI": round(cci, 4),
                "exact": round(em, 4), "exactCI": round(eci, 4),
                "verdict": verdict_for(dm, cm, em, benign=(cls == BENIGN)),
                "confusedWith": confused,
            }

        # Best model: exact first, category as tie-break -- the order an analyst
        # cares about when choosing which detector's label to trust.
        best = max(models, key=lambda m: (row["models"][m]["exact"], row["models"][m]["category"]))
        # Models within a point of the best are tied: when all four name a flood
        # perfectly, crowning one of them would tell a reader something false.
        top_exact = row["models"][best]["exact"]
        row["bestTied"] = [m for m in models if row["models"][m]["exact"] >= top_exact - TIE]
        best = row["bestTied"][0] if best in row["bestTied"] else best
        row["bestModel"] = best
        row["bestVerdict"] = row["models"][best]["verdict"]
        # Naming the attack and recognising its category are different skills,
        # and different models are best at each -- worth reporting both.
        row["bestCategoryModel"] = max(models, key=lambda m: (row["models"][m]["category"],
                                                               row["models"][m]["exact"]))
        per_attack.append(row)

    # Mixed campaign: several attacks at once, shuffled together, as an operator
    # would see them on the wire. Repeated with fresh draws each trial.
    attacks = [r["class"] for r in per_attack if r["class"] != BENIGN and not r["lowSupport"]]
    campaigns = []
    for r in runs:
        for trial in range(args.trials):
            chosen = rng.choice(attacks, size=min(4, len(attacks)), replace=False)
            idx = np.concatenate([rng.choice(np.flatnonzero(r["y"] == c), 25, replace=False)
                                  for c in chosen])
            rng.shuffle(idx)
            result = {"seed": r["seed"], "attacks": [str(c) for c in chosen]}
            for name in models:
                p = r["pred"][name][idx]
                result[name] = {
                    "detected": float(np.mean(p != BENIGN)),
                    "category": float(np.mean(r["pcat"][name][idx] == r["tcat"][idx])),
                    "exact": float(np.mean(p == r["y"][idx])),
                }
            campaigns.append(result)
    campaign_summary = {
        name: {k: round(ci95([c[name][k] for c in campaigns])[0], 4)
               for k in ("detected", "category", "exact")}
        for name in models
    }

    # Regression gates, evaluated on the best model per attack.
    failures = []
    for r in per_attack:
        top = {k: max(m[k] for m in r["models"].values()) for k in ("detected", "category", "exact")}
        if r["class"] in VOLUMETRIC and top["exact"] < GATES["volumetric_exact"]:
            failures.append(f"{r['class']}: exact {top['exact']:.3f} < {GATES['volumetric_exact']}")
        if r["class"] != BENIGN and not r["lowSupport"] and top["detected"] < GATES["attack_detected"]:
            failures.append(f"{r['class']}: detected {top['detected']:.3f} < {GATES['attack_detected']}")
        if r["category"] == "recon" and top["category"] < GATES["recon_category"]:
            failures.append(f"{r['class']}: category {top['category']:.3f} < {GATES['recon_category']}")

    report = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "config": {"trials": args.trials, "batch": args.batch, "seed": args.seed,
                   "modelSeeds": [r["seed"] for r in runs],
                   "reliableThreshold": RELIABLE, "gates": GATES},
        "models": models,
        "perAttack": per_attack,
        "campaign": {"trials": len(campaigns), "attacksPerCampaign": 4,
                     "flowsPerAttack": 25, "summary": campaign_summary},
        "gateFailures": failures,
        "passed": not failures,
        "seconds": round(time.perf_counter() - started, 1),
    }
    return report


def print_report(report):
    names = report["models"]
    short = {"RandomForest": "RF", "DecisionTree": "DT", "LogisticRegression": "LR", "SVM": "SVM"}
    mark = {"identified": "ID ", "category": "CAT", "detected": "DET", "missed": "MISS",
            "clean": "OK ", "false-alarm": "FA "}

    print(f"\n{'attack':<27}{'cat':<7}" + "".join(f"{short.get(n, n):>14}" for n in names) + "   best")
    print("-" * (34 + 14 * len(names) + 8))
    for r in report["perAttack"]:
        cells = ""
        for n in names:
            m = r["models"][n]
            cells += f"  {mark[m['verdict']]} {m['exact']:.2f}/{m['category']:.2f}"
        flag = " *" if r["lowSupport"] else ""
        tied = r["bestTied"]
        best = "tie (all)" if len(tied) == len(names) else "/".join(short.get(m, m) for m in tied)
        print(f"{r['class']:<27}{r['category']:<7}{cells}   {best}{flag}")
    print("\ncells: VERDICT exact/category.  ID=names the attack  CAT=right category, wrong name  "
          "DET=flagged, wrong category  MISS=waved through as benign.\n"
          "       Benign row: OK=passed clean  FA=raised false alarms.  * = <100 held-out flows, resampled.")

    print("\nMixed campaigns (4 simultaneous attacks, 25 flows each):")
    for n, s in report["campaign"]["summary"].items():
        print(f"    {n:<20} detected {s['detected']:.3f}   category {s['category']:.3f}   exact {s['exact']:.3f}")

    print()
    if report["passed"]:
        print(f"ALL GATES PASSED  ({report['seconds']}s)")
    else:
        print("GATE FAILURES:")
        for f in report["gateFailures"]:
            print("   ", f)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 1337, 2024],
                        help="model seeds to test; each uses its own trained models and split")
    parser.add_argument("--multiseed-data", dest="multiseed_data", default="data/multiseed")
    parser.add_argument("--multiseed-models", dest="multiseed_models", default="saved_models/multiseed")
    parser.add_argument("--trials", type=int, default=30, help="random batches per attack, per seed")
    parser.add_argument("--batch", type=int, default=50, help="flows per batch")
    parser.add_argument("--seed", type=int, default=None,
                        help="fix for a reproducible run; omit to test on fresh draws each time")
    parser.add_argument("--json-out", dest="json_out", default="evaluation_results/attack_tests.json")
    args = parser.parse_args()
    if args.seed is None:
        args.seed = int(time.time()) % 2**31
        print(f"[*] seed {args.seed} (pass --seed {args.seed} to repeat this exact run)")

    report = run(args)
    print_report(report)

    os.makedirs(os.path.dirname(args.json_out) or ".", exist_ok=True)
    with open(args.json_out, "w") as handle:
        json.dump(report, handle, indent=2)
    print(f"[+] {args.json_out}")
    sys.exit(0 if report["passed"] else 1)


if __name__ == "__main__":
    main()
