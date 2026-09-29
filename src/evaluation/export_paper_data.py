"""
Build the data behind the paper figures and their dashboard counterparts.

Writes frontend/data/paper.json with three blocks. The dashboard renders them
and src/evaluation/make_paper_figures.py draws the paper's figures from the same
file, so a figure in the paper and the chart on the dashboard can never disagree.

    confusion   row-normalised confusion matrices per model, mean over seeds
                (from evaluation_results/multiseed/multiseed_raw.json)
    importance  Random Forest impurity importance (mean over seeds), plus, for
                denial-of-service and reconnaissance flows separately, the share
                of "which attack is this?" that each feature resolves on its own
                (mutual information / label entropy). Permutation importance was
                tried first and reads near zero for every scan feature: they are
                so redundant that shuffling any one changes nothing.
    drift       ADWIN drift events for capture-order and shuffled streams, with
                the capture-file segments they fall on

Usage
-----
    python3 src/evaluation/export_paper_data.py
"""

import argparse
import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd
from sklearn.feature_selection import mutual_info_classif

VOLUMETRIC = {"SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood"}
DOS = VOLUMETRIC | {"ICMP_Flood", "ICMP_Fragmentation", "Slowloris_Scan"}
RECON = {"TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection",
         "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"}


def category(label):
    return "dos" if label in DOS else "recon" if label in RECON else "benign"


def build_confusion(multiseed):
    """Mean over seeds of each seed's row-normalised matrix, plus raw counts summed."""
    per_seed = multiseed["per_seed"]
    labels = per_seed[0]["models"]["RandomForest"]["confusion"]["labels"]
    # Group rows so the matrix reads DoS block, recon block, benign.
    order = sorted(labels, key=lambda c: ({"dos": 0, "recon": 1, "benign": 2}[category(c)],
                                          c not in VOLUMETRIC, c))
    idx = [labels.index(c) for c in order]
    out = {"labels": order, "categories": {c: category(c) for c in order}, "models": {}}
    for name in per_seed[0]["models"]:
        norm, counts = [], None
        for seed in per_seed:
            conf = seed["models"][name]["confusion"]
            assert conf["labels"] == labels, "label order differs between seeds"
            m = np.asarray(conf["matrix"], dtype=float)[np.ix_(idx, idx)]
            counts = m if counts is None else counts + m
            norm.append(m / np.maximum(m.sum(axis=1, keepdims=True), 1))
        out["models"][name] = {
            "rate": np.round(np.mean(norm, axis=0), 4).tolist(),
            "count": counts.astype(int).tolist(),
        }
    return out


def build_importance(seeds, data_root, models_root, sample, top, rng_seed):
    impurity, columns = [], None
    for seed in seeds:
        rf = joblib.load(os.path.join(models_root, f"seed-{seed}", "rf_model_multiclass.pkl"))
        impurity.append(rf.feature_importances_)
        columns = list(pd.read_csv(os.path.join(data_root, f"seed-{seed}", "X_test.csv"), nrows=0).columns)
    impurity = np.mean(impurity, axis=0)

    # Within each category, how much of the label uncertainty each feature
    # removes on its own. Model-free, so it describes the data, not the forest.
    seed = seeds[0]
    X = pd.read_csv(os.path.join(data_root, f"seed-{seed}", "X_test.csv"))
    y = pd.read_csv(os.path.join(data_root, f"seed-{seed}", "y_test.csv"))["Label_Multiclass"].to_numpy()
    rng = np.random.RandomState(rng_seed)
    per_cat = {}
    for cat in ("dos", "recon"):
        rows = np.flatnonzero(np.array([category(v) == cat for v in y]))
        rows = rng.choice(rows, size=min(sample, len(rows)), replace=False)
        labels = y[rows]
        p = pd.Series(labels).value_counts(normalize=True).to_numpy()
        entropy = float(-(p * np.log(p)).sum())
        mi = mutual_info_classif(X.iloc[rows], labels, random_state=rng_seed)
        per_cat[cat] = {"share": mi / entropy, "rows": int(len(rows)),
                        "classes": int(len(p)), "entropy": round(entropy, 4)}
        print(f"[*] {cat}: {len(rows):,} flows, best feature resolves {100 * (mi / entropy).max():.0f}%")

    def ranked(values):
        order = np.argsort(values)[::-1][:top]
        return [{"feature": columns[i], "value": round(float(values[i]), 5)} for i in order]

    return {
        "model": "RandomForest",
        "impurity": ranked(impurity),
        "separability": {cat: {"rows": v["rows"], "classes": v["classes"], "seed": seed,
                               "features": ranked(v["share"])}
                         for cat, v in per_cat.items()},
    }


def build_drift(file_log, shuffled_log, meta_path, labels_path):
    meta = pd.read_csv(meta_path)
    meta["label"] = pd.read_csv(labels_path)["Label_Multiclass"].to_numpy()
    # Same ordering as the ARF run with --stream-order file.
    meta = meta.sort_values("capture_timestamp_ms", kind="stable").reset_index(drop=True)
    source = meta["source_file"].to_numpy()
    starts = np.r_[0, np.flatnonzero(source[1:] != source[:-1]) + 1]
    ends = np.r_[starts[1:], len(source)]
    segments = []
    for s, e in zip(starts, ends):
        label = meta["label"].iloc[s:e].mode().iloc[0]
        segments.append({"start": int(s), "end": int(e), "file": source[s],
                         "label": label, "category": category(label)})

    def events(path):
        log = json.load(open(path))
        return {"accuracy": round(log["final_metrics"]["accuracy"], 4),
                "events": [{"instance": ev["instance"], "accuracy": round(ev["accuracy_at_drift"], 4)}
                           for ev in log["events"]]}

    boundaries = starts[1:]
    file_events = events(file_log)
    for ev in file_events["events"]:
        ev["distance"] = int(np.abs(boundaries - ev["instance"]).min())
    return {"instances": int(len(source)), "segments": segments,
            "capture": file_events, "shuffled": events(shuffled_log)}


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--multiseed", default="evaluation_results/multiseed/multiseed_raw.json")
    parser.add_argument("--data-root", default="data/multiseed")
    parser.add_argument("--models-root", default="saved_models/multiseed")
    parser.add_argument("--drift-file", default="evaluation_results/leakfree/arf_full_file_drift_events_multiclass.json")
    parser.add_argument("--drift-shuffled", default="evaluation_results/leakfree/arf_full_shuffled_drift_events_multiclass.json")
    parser.add_argument("--stream-meta", default="data/processed_v2/extended-unscaled/meta_train.csv")
    parser.add_argument("--stream-labels", default="data/processed_v2/extended-unscaled/y_train.csv")
    parser.add_argument("--sample", type=int, default=6000, help="Flows per category for the separability measure")
    parser.add_argument("--top", type=int, default=12)
    parser.add_argument("--seed", type=int, default=0)
    parser.add_argument("--out", default="frontend/data/paper.json")
    args = parser.parse_args()

    multiseed = json.load(open(args.multiseed))
    bundle = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seeds": multiseed["seeds"],
        "confusion": build_confusion(multiseed),
        "importance": build_importance(multiseed["seeds"], args.data_root, args.models_root,
                                       args.sample, args.top, args.seed),
        "drift": build_drift(args.drift_file, args.drift_shuffled, args.stream_meta, args.stream_labels),
    }
    with open(args.out, "w") as handle:
        json.dump(bundle, handle, separators=(",", ":"))
    print(f"[+] {args.out}  ({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
