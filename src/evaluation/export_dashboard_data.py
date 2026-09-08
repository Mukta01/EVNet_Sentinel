"""
Export the research findings and a replayable inference set for the dashboard.

Produces two JSON bundles consumed by `frontend/app/dashboard`. Both are static,
so the dashboard renders on any deploy with no Python backend running.

Nothing here is synthetic in the sense of invented. The "simulation" replays
**real held-out flows** from the test split and records what the **actually
trained models** predicted for them, computed once at export time. The dashboard
replays those recorded predictions; it never fabricates a verdict.

Usage
-----
    python3 src/evaluation/export_dashboard_data.py \
        --data-dir   data/processed_v2/extended-nosrcport \
        --models-dir saved_models/leakfree-nosrcport \
        --out-dir    frontend/public/data
"""

import argparse
import json
import os
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

# The project's central finding needs a grouping that survives scrutiny.
#
# An earlier version lumped every denial-of-service class together, which pulled
# the "solved" group's mean down to 0.786 and invited the obvious objection that
# reconnaissance simply has less data. Splitting by mechanism removes that:
#
#   volumetric floods  32k-259k flows  F1 0.999-1.000
#   reconnaissance     27k-39k  flows  F1 0.105-0.265
#
# UDP_Flood (32,072 flows, F1 0.999) against TCP_Port_Scan (35,123 flows, F1
# 0.265) is the pair that settles it: comparable support, opposite outcomes.
#
# The remaining classes are held separately because no honest claim can be made
# about them -- Benign has 81 flows, ICMP_Flood 32, ICMP_Fragmentation 28, and
# Slowloris is a low-rate attack whose flows look nothing like a volumetric flood.
VOLUMETRIC_CLASSES = {"SYN_Flood", "TCP_Flood", "UDP_Flood",
                      "SynonymousIP_Flood", "PSHACK_Flood"}
RECON_CLASSES = {"TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection",
                 "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"}

MODEL_FILES = {
    "RandomForest": "rf_model_multiclass.pkl",
    "DecisionTree": "dt_model_multiclass.pkl",
    "SVM": "svm_model_multiclass.pkl",
    "LogisticRegression": "logreg_model_multiclass.pkl",
}

# Shown on the flow inspector. Chosen because each is legible to a reader who
# knows TCP but not this dataset, and together they explain most verdicts.
DISPLAY_FEATURES = [
    ("dst_port", "Destination port", ""),
    ("protocol", "Protocol", ""),
    ("bidirectional_packets", "Packets", ""),
    ("bidirectional_bytes", "Bytes", "B"),
    ("bidirectional_duration_ms", "Duration", "ms"),
    ("bidirectional_mean_ps", "Mean packet size", "B"),
    ("bidirectional_mean_piat_ms", "Mean inter-arrival", "ms"),
    ("bidirectional_syn_packets", "SYN packets", ""),
    ("bidirectional_ack_packets", "ACK packets", ""),
    ("bidirectional_rst_packets", "RST packets", ""),
    ("src2dst_packets", "Forward packets", ""),
    ("dst2src_packets", "Return packets", ""),
]


def group_of(label):
    if label in VOLUMETRIC_CLASSES:
        return "volumetric"
    if label in RECON_CLASSES:
        return "recon"
    return "other"


def confidence_for(model, X):
    """Probability where available; a squashed decision margin for hinge loss."""
    if hasattr(model, "predict_proba"):
        try:
            return model.predict_proba(X).max(axis=1)
        except Exception:
            pass
    if hasattr(model, "decision_function"):
        scores = np.atleast_2d(model.decision_function(X))
        top = np.sort(scores, axis=1)
        margin = top[:, -1] - top[:, -2] if scores.shape[1] > 1 else np.abs(top[:, -1])
        return 1 / (1 + np.exp(-margin))  # margin -> (0.5, 1)
    return np.full(len(X), float("nan"))


def class_support(data_dir):
    """Total flows per class across all partitions, so the chart can show support."""
    frames = []
    for part in ("train", "val", "test"):
        path = os.path.join(data_dir, f"y_{part}.csv")
        if os.path.exists(path):
            frames.append(pd.read_csv(path, usecols=["Label_Multiclass"]))
    if not frames:
        return {}
    counts = pd.concat(frames)["Label_Multiclass"].value_counts()
    return {str(k): int(v) for k, v in counts.items()}


def build_findings(multiseed_path, out_dir, support):
    raw = json.load(open(multiseed_path))
    per_seed, env = raw["per_seed"], raw["environment"]
    model_names = list(per_seed[0]["models"])

    def agg(model, key):
        values = [s["models"][model][key] for s in per_seed]
        return round(float(np.mean(values)), 4), round(float(np.std(values)), 4)

    models = []
    for name in model_names:
        entry = {"name": name}
        for key in ("macro_f1", "weighted_f1", "accuracy", "fit_seconds", "predict_seconds"):
            mean, std = agg(name, key)
            entry[key] = mean
            entry[f"{key}_std"] = std
        models.append(entry)
    models.sort(key=lambda m: -m["macro_f1"])

    classes = sorted({c for s in per_seed for c in s["models"][model_names[0]]["per_class_f1"]})
    per_class = []
    for cls in classes:
        row = {"class": cls, "group": group_of(cls),
               "support": support.get(cls, 0), "models": {}}
        for name in model_names:
            values = [s["models"][name]["per_class_f1"].get(cls, 0.0) for s in per_seed]
            row["models"][name] = {"f1": round(float(np.mean(values)), 4),
                                   "std": round(float(np.std(values)), 4)}
        per_class.append(row)
    order = {"volumetric": 0, "recon": 1, "other": 2}
    per_class.sort(key=lambda r: (order[r["group"]], -r["models"][models[0]["name"]]["f1"]))

    findings = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "seeds": raw["seeds"],
        "featureSet": raw["feature_set"],
        "environment": env,
        "dataset": per_seed[0]["dataset"],
        "models": models,
        "perClass": per_class,
        # Measured by src/reproduction/ablate_fingerprints.py
        "fingerprintAblation": [
            {"timestamps": "kept", "dstPort": "kept", "total": 2728799, "recon": 1724504, "flood": 1001106},
            {"timestamps": "kept", "dstPort": "dropped", "total": 1277520, "recon": 273932,
             "flood": 1001106, "isReference": True},
            {"timestamps": "dropped", "dstPort": "kept", "total": 1198143, "recon": 194737, "flood": 1000544},
            {"timestamps": "dropped", "dstPort": "dropped", "total": 977862, "recon": 6821, "flood": 970079},
        ],
        # Macro-F1 before and after removing the six absolute timestamp columns
        "leakEffect": [
            {"model": "RandomForest", "leaked": 0.9547, "corrected": 0.5894},
            {"model": "LogisticRegression", "leaked": 0.4622, "corrected": 0.3308},
            {"model": "SVM", "leaked": 0.2829, "corrected": 0.3084},
        ],
        "singleColumnProbe": [
            {"feature": "bidirectional_first_seen_ms", "accuracy": 0.9976, "legitimate": False},
            {"feature": "src_port", "accuracy": 0.4028, "legitimate": False},
            {"feature": "dst_port", "accuracy": 0.2917, "legitimate": True},
        ],
        # src/reproduction/drift_boundary_alignment.py over the full 1.92M stream
        "drift": {
            "events": 43, "withinHundred": 42, "medianDistance": 22,
            "nullMean": 2.2, "nullStd": 1.5, "captures": 58,
        },
        "streamOrder": [
            {"order": "Capture order", "accuracy": 0.9997, "weightedF1": 0.9997,
             "events": 43, "minutes": 25.5},
            {"order": "Shuffled", "accuracy": 0.5585, "weightedF1": 0.5129,
             "events": 14, "minutes": 255.3},
        ],
        "paperReported": {"accuracy": 0.9840, "weightedF1": 0.9831, "driftEvents": 11},
        # The pair that rules out "reconnaissance simply has less data".
        "supportControl": {
            "solved": {"class": "UDP_Flood", "support": support.get("UDP_Flood", 0)},
            "unsolved": {"class": "TCP_Port_Scan", "support": support.get("TCP_Port_Scan", 0)},
        },
    }

    path = os.path.join(out_dir, "findings.json")
    with open(path, "w") as handle:
        json.dump(findings, handle, indent=2)
    print(f"[+] {path}  ({len(models)} models, {len(per_class)} classes)")
    return findings


def build_simulation(data_dir, models_dir, out_dir, per_class_count, seed):
    X_test = pd.read_csv(os.path.join(data_dir, "X_test.csv"))
    y_test = pd.read_csv(os.path.join(data_dir, "y_test.csv"))["Label_Multiclass"]

    scaler_path = os.path.join(data_dir, "StandardScaler.pkl")
    scaler = joblib.load(scaler_path) if os.path.exists(scaler_path) else None

    models = {}
    for name, filename in MODEL_FILES.items():
        path = os.path.join(models_dir, filename)
        if os.path.exists(path):
            models[name] = joblib.load(path)
        else:
            print(f"[!] missing {path} -- skipping {name}")
    if not models:
        raise SystemExit(f"No models found in {models_dir}")

    # Stratified sample: every class represented, so the replay covers the whole
    # taxonomy rather than drowning in the flood classes.
    rng = np.random.RandomState(seed)
    picked = []
    for cls in sorted(y_test.unique()):
        candidates = np.flatnonzero((y_test == cls).to_numpy())
        take = min(per_class_count, len(candidates))
        picked.extend(rng.choice(candidates, take, replace=False))
    picked = np.array(picked)
    rng.shuffle(picked)

    sample = X_test.iloc[picked]
    truth = y_test.iloc[picked].tolist()

    predictions, confidences = {}, {}
    for name, model in models.items():
        predictions[name] = model.predict(sample).tolist()
        confidences[name] = confidence_for(model, sample)
        print(f"    {name}: predicted {len(predictions[name])} flows")

    # Features are standardised on disk; invert so the inspector shows real units.
    if scaler is not None:
        readable = pd.DataFrame(scaler.inverse_transform(sample),
                                columns=X_test.columns, index=sample.index)
    else:
        readable = sample

    flows = []
    for position, (index, true_label) in enumerate(zip(sample.index, truth)):
        features = []
        for column, label, unit in DISPLAY_FEATURES:
            if column not in readable.columns:
                continue
            value = float(readable.loc[index, column])
            features.append({"key": column, "label": label, "unit": unit,
                             "value": round(value, 3)})
        verdicts = {}
        for name in models:
            confidence = confidences[name][position]
            verdicts[name] = {
                "label": predictions[name][position],
                "correct": bool(predictions[name][position] == true_label),
                "confidence": None if np.isnan(confidence) else round(float(confidence), 4),
            }
        flows.append({
            "id": int(index),
            "trueLabel": true_label,
            "group": group_of(true_label),
            "features": features,
            "predictions": verdicts,
        })

    simulation = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "provenance": (
            "Real held-out flows from the CICEVSE2024 test split. Every verdict is "
            "the actual output of the corresponding trained model, computed at "
            "export time. Nothing is generated or estimated."
        ),
        "source": {"dataDir": data_dir, "modelsDir": models_dir,
                   "testRows": int(len(X_test)), "sampled": int(len(flows))},
        "models": list(models),
        "classes": sorted(y_test.unique().tolist()),
        "flows": flows,
    }

    path = os.path.join(out_dir, "simulation.json")
    with open(path, "w") as handle:
        json.dump(simulation, handle, indent=2)
    size_kb = os.path.getsize(path) / 1024
    print(f"[+] {path}  ({len(flows)} flows, {len(models)} models, {size_kb:.0f} KB)")

    for name in models:
        hits = sum(1 for f in flows if f["predictions"][name]["correct"])
        print(f"    {name:<20} {hits}/{len(flows)} correct on the replay sample")
    return simulation


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", dest="data_dir", default="data/processed_v2/extended-nosrcport")
    parser.add_argument("--models-dir", dest="models_dir", default="saved_models/leakfree-nosrcport")
    parser.add_argument("--multiseed", default="evaluation_results/multiseed/multiseed_raw.json")
    parser.add_argument("--out-dir", dest="out_dir", default="frontend/data")
    parser.add_argument("--per-class", dest="per_class", type=int, default=10)
    parser.add_argument("--seed", type=int, default=42)
    args = parser.parse_args()

    os.makedirs(args.out_dir, exist_ok=True)
    support = class_support(args.data_dir)
    build_findings(args.multiseed, args.out_dir, support)
    build_simulation(args.data_dir, args.models_dir, args.out_dir, args.per_class, args.seed)


if __name__ == "__main__":
    main()
