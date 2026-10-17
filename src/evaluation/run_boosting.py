"""
XGBoost and LightGBM on the same splits as the multi-seed benchmark.

run_experiments.py writes each seed's train/val/test split to data/multiseed/
seed-<n>/. This script reuses those exact files, so the boosted models are
compared like-for-like with Random Forest, Decision Tree, Logistic Regression
and SVM: same rows, same 60 features, same held-out test set, same seeds.

Hyperparameters are fixed in advance, not tuned on the test set. The
validation split is used only for early stopping. Class imbalance is handled
with balanced sample weights, the same rule as class_weight='balanced'.

Writes evaluation_results/boosting/{BOOSTING_RESULTS.md, boosting_raw.json}
and saved_models/multiseed/seed-<n>/{xgb,lgbm}_model_multiclass.pkl.

Usage
-----
    python3 src/evaluation/run_boosting.py --seeds 42 1337 2024
"""

import argparse
import json
import os
import sys
import time

import joblib
import numpy as np
import pandas as pd
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix, f1_score

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
from src.models.boosting import LabelEncodedBooster  # noqa: E402

MODELS = {
    "XGBoost": ("xgb", lambda seed: LabelEncodedBooster(
        "xgboost", seed, n_estimators=400, max_depth=8, learning_rate=0.1,
        subsample=0.8, colsample_bytree=0.8)),
    "LightGBM": ("lgbm", lambda seed: LabelEncodedBooster(
        "lightgbm", seed, n_estimators=600, num_leaves=63, learning_rate=0.05,
        subsample=0.8, subsample_freq=1, colsample_bytree=0.8)),
}


def run_seed(data_root, models_root, seed):
    d = os.path.join(data_root, f"seed-{seed}")
    load = lambda n: pd.read_csv(os.path.join(d, n))  # noqa: E731
    X_tr, X_val, X_te = load("X_train.csv"), load("X_val.csv"), load("X_test.csv")
    y_tr, y_val, y_te = (load(f"y_{p}.csv")["Label_Multiclass"] for p in ("train", "val", "test"))
    leaking = [c for c in X_tr.columns if c.endswith("_seen_ms") or c == "src_port"]
    if leaking:
        raise SystemExit(f"Leaking columns in {d}: {leaking}")
    print(f"\n[seed {seed}] train {len(X_tr):,}  val {len(X_val):,}  test {len(X_te):,}  features {X_tr.shape[1]}")

    out = {}
    for name, (slug, build) in MODELS.items():
        model = build(seed)
        t0 = time.perf_counter()
        model.fit(X_tr, y_tr, X_val, y_val)
        fit_s = time.perf_counter() - t0
        t0 = time.perf_counter()
        pred = model.predict(X_te)
        pred_s = time.perf_counter() - t0
        report = classification_report(y_te, pred, output_dict=True, zero_division=0)
        labels = sorted(set(y_te) | set(pred))
        os.makedirs(os.path.join(models_root, f"seed-{seed}"), exist_ok=True)
        joblib.dump(model, os.path.join(models_root, f"seed-{seed}", f"{slug}_model_multiclass.pkl"))
        out[name] = {
            "macro_f1": f1_score(y_te, pred, average="macro", zero_division=0),
            "weighted_f1": f1_score(y_te, pred, average="weighted", zero_division=0),
            "accuracy": accuracy_score(y_te, pred),
            "fit_seconds": round(fit_s, 2), "predict_seconds": round(pred_s, 2),
            "rounds": int(getattr(model.model, "best_iteration", None) or getattr(model.model, "best_iteration_", 0) or 0),
            "per_class_f1": {k: v["f1-score"] for k, v in report.items()
                             if isinstance(v, dict) and k not in ("macro avg", "weighted avg")},
            "confusion": {"labels": labels, "matrix": confusion_matrix(y_te, pred, labels=labels).tolist()},
        }
        print(f"  {name:<9} macro-F1 {out[name]['macro_f1']:.4f}  acc {out[name]['accuracy']:.4f}  "
              f"fit {fit_s:6.1f}s  rounds {out[name]['rounds']}")
    return out


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--seeds", type=int, nargs="+", default=[42, 1337, 2024])
    ap.add_argument("--data-root", default="data/multiseed")
    ap.add_argument("--models-root", default="saved_models/multiseed")
    ap.add_argument("--baseline", default="evaluation_results/multiseed/multiseed_raw.json")
    ap.add_argument("--out", default="evaluation_results/boosting")
    ap.add_argument("--report-only", action="store_true",
                    help="Rebuild BOOSTING_RESULTS.md from boosting_raw.json without retraining")
    args = ap.parse_args()

    raw_path = os.path.join(args.out, "boosting_raw.json")
    if args.report_only:
        per_seed = json.load(open(raw_path))["per_seed"]
    else:
        per_seed = [{"seed": s, "models": run_seed(args.data_root, args.models_root, s)} for s in args.seeds]
        os.makedirs(args.out, exist_ok=True)
        with open(raw_path, "w") as h:
            json.dump({"seeds": args.seeds, "per_seed": per_seed}, h)

    def stat(runs, name, key):
        v = [r["models"][name][key] for r in runs]
        return float(np.mean(v)), float(np.std(v))

    base = json.load(open(args.baseline))
    base_runs = [r for seed, r in zip(base["seeds"], base["per_seed"]) if seed in args.seeds]
    rows = [(n, per_seed) for n in MODELS] + [(n, base_runs) for n in base_runs[0]["models"]]
    rows.sort(key=lambda r: -stat(r[1], r[0], "macro_f1")[0])

    lines = ["# Boosted trees vs the baseline models", "",
             f"Same splits, features and seeds ({', '.join(map(str, args.seeds))}) as "
             "`evaluation_results/multiseed/`. Mean ± std over seeds.", "",
             "| Model | Macro-F1 | Weighted F1 | Accuracy | Fit (s) |", "|---|---|---|---|---|"]
    for name, runs in rows:
        m, s = stat(runs, name, "macro_f1")
        tag = " *(new)*" if name in MODELS else ""
        lines.append(f"| {name}{tag} | {m:.4f} ± {s:.4f} | {stat(runs, name, 'weighted_f1')[0]:.4f} | "
                     f"{stat(runs, name, 'accuracy')[0]:.4f} | {stat(runs, name, 'fit_seconds')[0]:.1f} |")

    classes = sorted(per_seed[0]["models"]["XGBoost"]["per_class_f1"])
    names = [n for n, _ in rows]
    lines += ["", "## Per-class F1 (mean over seeds)", "", "| Class | " + " | ".join(names) + " |",
              "|---|" + "---|" * len(names)]
    for c in classes:
        cells = []
        for name, runs in rows:
            v = np.mean([r["models"][name]["per_class_f1"].get(c, 0.0) for r in runs])
            cells.append(f"{np.floor(v * 1e4) / 1e4:.4f}" if 0.995 <= v < 1 else f"{v:.3f}")
        lines.append(f"| {c} | " + " | ".join(cells) + " |")
    with open(os.path.join(args.out, "BOOSTING_RESULTS.md"), "w") as h:
        h.write("\n".join(lines) + "\n")
    print("\n".join(lines[:6 + len(rows)]))


if __name__ == "__main__":
    main()
