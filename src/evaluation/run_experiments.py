"""
Multi-seed experiment runner for the leakage-corrected reproduction (issue #55).

Every headline number in the write-up comes from here. For each seed it re-runs
the split, retrains all four static models, and records metrics and wall-clock
timings; results are aggregated as mean +/- std so a single lucky split cannot
be mistaken for a result.

The seed varies **both** the train/val/test split and model initialisation. Only
varying model seeds would understate the variance, because with `Benign` at 82
flows and `ICMP_Fragmentation` at 28 the split itself is the dominant source of
run-to-run noise.

Hyperparameters are copied from the per-model training scripts so the numbers
stay comparable with them:

    Random Forest        n_estimators=100, max_depth=15, class_weight=balanced
    Decision Tree        max_depth=20, class_weight=balanced
    SVM                  SGDClassifier(loss='hinge'), class_weight=balanced
    Logistic Regression  SGDClassifier(loss='log_loss'), class_weight=balanced

Usage
-----
    python3 src/evaluation/run_experiments.py \
        --raw-dir "datasets/CICEVSE2024_Dataset" \
        --feature-set extended --seeds 42 1337 2024 \
        --output-dir evaluation_results/multiseed
"""

import argparse
import json
import os
import platform
import subprocess
import sys
import time

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.linear_model import SGDClassifier
from sklearn.metrics import accuracy_score, classification_report, f1_score
from sklearn.tree import DecisionTreeClassifier
from sklearn.utils.class_weight import compute_class_weight

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))

MODELS = {
    "RandomForest": lambda cw, seed: RandomForestClassifier(
        n_estimators=100, max_depth=15, class_weight=cw, random_state=seed, n_jobs=-1),
    "DecisionTree": lambda cw, seed: DecisionTreeClassifier(
        max_depth=20, class_weight=cw, random_state=seed),
    "SVM": lambda cw, seed: SGDClassifier(
        loss="hinge", class_weight=cw, random_state=seed),
    "LogisticRegression": lambda cw, seed: SGDClassifier(
        loss="log_loss", class_weight=cw, random_state=seed),
}


def environment_report():
    """Everything needed to reproduce these numbers on other hardware."""
    def sysctl(key):
        try:
            return subprocess.run(["sysctl", "-n", key], capture_output=True,
                                  text=True, timeout=5).stdout.strip()
        except Exception:
            return "unknown"

    import sklearn
    versions = {"python": platform.python_version(), "numpy": np.__version__,
                "pandas": pd.__version__, "scikit-learn": sklearn.__version__}
    try:
        import river
        versions["river"] = river.__version__
    except ImportError:
        pass

    memory = sysctl("hw.memsize")
    return {
        "cpu": sysctl("machdep.cpu.brand_string") or platform.processor(),
        "logical_cores": os.cpu_count(),
        "ram_gb": round(int(memory) / 1024**3) if memory.isdigit() else "unknown",
        "os": f"{platform.system()} {platform.release()}",
        "machine": platform.machine(),
        "versions": versions,
    }


def run_seed(raw_dir, feature_set, dedup, split, seed, work_dir):
    """Preprocess with this seed, then train and score every model."""
    from src.data_prep.preprocess import (clean_and_reduce_features, engineer_features,
                                          load_network_traffic_data, split_and_export_data)

    out_dir = os.path.join(work_dir, f"seed-{seed}")
    print(f"\n{'=' * 70}\n[seed {seed}] preprocessing ({feature_set}, {split}, dedup={dedup})\n{'=' * 70}")

    t0 = time.perf_counter()
    df = load_network_traffic_data(raw_dir)
    df = clean_and_reduce_features(df, feature_set=feature_set, dedup=dedup)
    X, y, meta = engineer_features(df)
    split_and_export_data(X, y, meta, output_dir=out_dir, strategy=split, random_state=seed)
    prep_seconds = time.perf_counter() - t0

    dataset_stats = {
        "rows_after_dedup": int(len(X)),
        "n_features": int(X.shape[1]),
        "preprocess_seconds": round(prep_seconds, 1),
    }
    del df, X, y, meta

    X_train = pd.read_csv(f"{out_dir}/X_train.csv")
    y_train = pd.read_csv(f"{out_dir}/y_train.csv")["Label_Multiclass"]
    X_test = pd.read_csv(f"{out_dir}/X_test.csv")
    y_test = pd.read_csv(f"{out_dir}/y_test.csv")["Label_Multiclass"]
    dataset_stats.update(train_rows=len(X_train), test_rows=len(X_test),
                         n_classes=int(y_train.nunique()))

    classes = np.array(sorted(y_train.unique()))
    class_weight = dict(zip(classes, compute_class_weight("balanced", classes=classes, y=y_train)))

    results = {}
    for name, build in MODELS.items():
        model = build(class_weight, seed)
        t0 = time.perf_counter()
        model.fit(X_train, y_train)
        fit_seconds = time.perf_counter() - t0

        t0 = time.perf_counter()
        predicted = model.predict(X_test)
        predict_seconds = time.perf_counter() - t0

        per_class = classification_report(y_test, predicted, output_dict=True, zero_division=0)
        results[name] = {
            "macro_f1": f1_score(y_test, predicted, average="macro", zero_division=0),
            "weighted_f1": f1_score(y_test, predicted, average="weighted", zero_division=0),
            "accuracy": accuracy_score(y_test, predicted),
            "fit_seconds": round(fit_seconds, 2),
            "predict_seconds": round(predict_seconds, 2),
            "per_class_f1": {k: v["f1-score"] for k, v in per_class.items()
                             if isinstance(v, dict) and k not in
                             ("macro avg", "weighted avg", "accuracy")},
        }
        print(f"  {name:<20} macro-F1 {results[name]['macro_f1']:.4f}  "
              f"acc {results[name]['accuracy']:.4f}  fit {fit_seconds:6.1f}s")

    return {"dataset": dataset_stats, "models": results}


def aggregate(per_seed, output_dir, feature_set, seeds, environment):
    """Mean +/- std across seeds, written as markdown and JSON."""
    names = list(MODELS)
    lines = [
        "# Multi-Seed Results",
        "",
        f"Feature set `{feature_set}`, seeds {seeds}. Each seed re-runs the split *and* model",
        "initialisation, so the spread reflects split variance rather than tie-breaking alone.",
        "Generated by `src/evaluation/run_experiments.py` (issue #55).",
        "",
        "## Headline — multiclass, 15 classes",
        "",
        "**Macro-F1 is the headline metric.** With `ICMP_Fragmentation` at 28 raw flows and",
        "`Benign` at 82, accuracy tracks the flood classes and hides everything else.",
        "",
        "| Model | Macro-F1 | Weighted-F1 | Accuracy |",
        "|---|---|---|---|",
    ]

    def stat(model, key):
        values = [s["models"][model][key] for s in per_seed]
        return np.mean(values), np.std(values)

    ranked = sorted(names, key=lambda m: -stat(m, "macro_f1")[0])
    for model in ranked:
        cells = []
        for key in ("macro_f1", "weighted_f1", "accuracy"):
            mean, std = stat(model, key)
            cells.append(f"{mean:.4f} ± {std:.4f}")
        lines.append(f"| {model} | **{cells[0]}** | {cells[1]} | {cells[2]} |")

    lines += ["", "## Per-class F1 (mean ± std across seeds)", "",
              "| Class | " + " | ".join(ranked) + " |",
              "|---" * (len(ranked) + 1) + "|"]

    all_classes = sorted({c for s in per_seed for c in s["models"][names[0]]["per_class_f1"]})
    dos = {"SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood",
           "ICMP_Flood", "ICMP_Fragmentation", "Slowloris_Scan"}
    for cls in sorted(all_classes, key=lambda c: (c not in dos, c)):
        row = [f"`{cls}`"]
        for model in ranked:
            values = [s["models"][model]["per_class_f1"].get(cls, 0.0) for s in per_seed]
            row.append(f"{np.mean(values):.3f} ± {np.std(values):.3f}")
        lines.append("| " + " | ".join(row) + " |")

    lines += ["", "## Runtime", "",
              "| Model | Fit (s) | Predict (s) |", "|---|---|---|"]
    for model in ranked:
        fit_mean, fit_std = stat(model, "fit_seconds")
        pred_mean, pred_std = stat(model, "predict_seconds")
        lines.append(f"| {model} | {fit_mean:.1f} ± {fit_std:.1f} | {pred_mean:.1f} ± {pred_std:.1f} |")

    d = per_seed[0]["dataset"]
    lines += ["", "## Dataset", "",
              f"- Rows after deduplication: **{d['rows_after_dedup']:,}**",
              f"- Features: **{d['n_features']}**",
              f"- Classes: **{d['n_classes']}**",
              f"- Train / test rows: {d['train_rows']:,} / {d['test_rows']:,} (70/15/15 split)",
              f"- Preprocessing wall clock: {d['preprocess_seconds']:.0f} s per seed",
              "", "## Environment", "",
              "| Component | Value |", "|---|---|",
              f"| CPU | {environment['cpu']} |",
              f"| Logical cores | {environment['logical_cores']} |",
              f"| RAM | {environment['ram_gb']} GB |",
              f"| OS | {environment['os']} ({environment['machine']}) |"]
    for lib, version in environment["versions"].items():
        lines.append(f"| {lib} | {version} |")
    lines.append("")

    os.makedirs(output_dir, exist_ok=True)
    markdown = "\n".join(lines)
    with open(os.path.join(output_dir, "MULTISEED_RESULTS.md"), "w") as handle:
        handle.write(markdown)
    with open(os.path.join(output_dir, "multiseed_raw.json"), "w") as handle:
        json.dump({"feature_set": feature_set, "seeds": seeds,
                   "environment": environment, "per_seed": per_seed}, handle, indent=2)
    print("\n" + markdown)
    print(f"\n[+] Wrote {output_dir}/MULTISEED_RESULTS.md")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", dest="raw_dir", default="data/raw")
    parser.add_argument("--feature-set", dest="feature_set", default="extended")
    parser.add_argument("--dedup", default="global")
    parser.add_argument("--split", default="random")
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 1337, 2024])
    parser.add_argument("--output-dir", dest="output_dir", default="evaluation_results/multiseed")
    parser.add_argument("--work-dir", dest="work_dir", default="data/multiseed")
    args = parser.parse_args()

    environment = environment_report()
    print(f"Environment: {environment['cpu']}, {environment['logical_cores']} cores, "
          f"{environment['ram_gb']} GB, {environment['os']}")

    per_seed = []
    started = time.perf_counter()
    for seed in args.seeds:
        per_seed.append(run_seed(args.raw_dir, args.feature_set, args.dedup,
                                 args.split, seed, args.work_dir))
    print(f"\nAll seeds finished in {(time.perf_counter() - started) / 60:.1f} min")

    aggregate(per_seed, args.output_dir, args.feature_set, args.seeds, environment)


if __name__ == "__main__":
    main()
