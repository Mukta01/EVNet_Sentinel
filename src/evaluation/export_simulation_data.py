"""
Export the flow pool that drives the /simulation console.

Everything the console shows is real. Flows are held-out test rows, verdicts are
the actual outputs of the trained detectors, and topology placement comes from
the `evse` / `state` / `source_file` metadata preserved during preprocessing.

Five detectors. The four static models are a lookup: their verdict for a given
flow never changes. ARF + ADWIN is not, because it learns as the stream runs, so
its verdicts are recorded from a single prequential pass over a fixed sequence
and the console replays that sequence. Its running accuracy is stored per step,
which is what lets the console show it improving.

The benign baseline uses only the 12 held-out benign flows. The dataset contains
81 in total, but 69 sit in the train split -- the models were fitted on them, so
replaying those would show memorised verdicts rather than detection.

Usage
-----
    python3 src/evaluation/export_simulation_data.py \
        --data-dir     data/processed_v2/extended-nosrcport \
        --unscaled-dir data/processed_v2/extended-nosrcport-unscaled \
        --models-dir   saved_models/leakfree-nosrcport \
        --out          frontend/data/network-sim.json
"""

import argparse
import json
import os
import time
from datetime import datetime, timezone

import joblib
import numpy as np
import pandas as pd

VOLUMETRIC = {"SYN_Flood", "TCP_Flood", "UDP_Flood", "SynonymousIP_Flood", "PSHACK_Flood"}
RECON = {"TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection",
         "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"}
BENIGN = {"Benign"}

MODEL_FILES = {
    "RandomForest": "rf_model_multiclass.pkl",
    "DecisionTree": "dt_model_multiclass.pkl",
    "SVM": "svm_model_multiclass.pkl",
    "LogisticRegression": "logreg_model_multiclass.pkl",
}

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
    if label in VOLUMETRIC:
        return "volumetric"
    if label in RECON:
        return "recon"
    if label in BENIGN:
        return "benign"
    return "other"


def confidence_for(model, X):
    if hasattr(model, "predict_proba"):
        try:
            return model.predict_proba(X).max(axis=1)
        except Exception:
            pass
    if hasattr(model, "decision_function"):
        scores = np.atleast_2d(model.decision_function(X))
        top = np.sort(scores, axis=1)
        margin = top[:, -1] - top[:, -2] if scores.shape[1] > 1 else np.abs(top[:, -1])
        return 1 / (1 + np.exp(-margin))
    return np.full(len(X), np.nan)


def pick_pool(y_test, per_class, seed):
    """Up to `per_class` held-out flows for each class, every class represented."""
    rng = np.random.RandomState(seed)
    picked = []
    for cls in sorted(y_test.unique()):
        candidates = np.flatnonzero((y_test == cls).to_numpy())
        picked.extend(rng.choice(candidates, min(per_class, len(candidates)), replace=False))
    return np.array(sorted(picked))


def run_arf(unscaled_dir, positions, labels, warm_rows, seed):
    """
    Warm an ARF on the training stream, then score the pool prequentially.

    Returns per-position verdicts plus the running accuracy after each step, so
    the console can show the online learner improving rather than asserting it.
    """
    from river import drift, forest, preprocessing

    model = preprocessing.StandardScaler() | forest.ARFClassifier(
        n_models=20, max_features=0.5, grace_period=30, leaf_prediction="nba",
        drift_detector=drift.ADWIN(delta=0.002),
        warning_detector=drift.ADWIN(delta=0.002), seed=seed,
    )

    print(f"[*] Warming ARF on {warm_rows:,} training flows...")
    Xw = pd.read_csv(os.path.join(unscaled_dir, "X_train.csv"), nrows=warm_rows)
    yw = pd.read_csv(os.path.join(unscaled_dir, "y_train.csv"), nrows=warm_rows)["Label_Multiclass"]
    columns = list(Xw.columns)
    started = time.perf_counter()
    for row, label in zip(Xw.to_numpy(dtype=float), yw.tolist()):
        model.learn_one(dict(zip(columns, row)), label)
    print(f"    warmed in {time.perf_counter() - started:.0f}s")

    Xt = pd.read_csv(os.path.join(unscaled_dir, "X_test.csv"))
    pool = Xt.iloc[positions].to_numpy(dtype=float)
    del Xt

    # A fixed interleaved order, so ARF meets a realistic mix rather than every
    # SYN flood followed by every port scan.
    order = np.random.RandomState(seed).permutation(len(pool))

    print(f"[*] Prequential pass over {len(pool):,} pooled flows...")
    verdicts = [None] * len(pool)
    correct = 0
    for step, idx in enumerate(order, start=1):
        x = dict(zip(columns, pool[idx]))
        predicted = model.predict_one(x)
        truth = labels[idx]
        if predicted is None:
            predicted = truth
        hit = predicted == truth
        correct += int(hit)
        verdicts[idx] = {
            "label": predicted,
            "group": group_of(predicted),
            "correct": bool(hit),
            "confidence": None,
            "step": step,
            "runningAccuracy": round(correct / step, 4),
        }
        model.learn_one(x, truth)
    print(f"    ARF final running accuracy {correct / len(pool):.4f}")
    return verdicts


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", dest="data_dir", default="data/processed_v2/extended-nosrcport")
    parser.add_argument("--unscaled-dir", dest="unscaled_dir",
                        default="data/processed_v2/extended-nosrcport-unscaled")
    parser.add_argument("--models-dir", dest="models_dir", default="saved_models/leakfree-nosrcport")
    parser.add_argument("--out", default="frontend/data/network-sim.json")
    parser.add_argument("--per-class", dest="per_class", type=int, default=180)
    parser.add_argument("--warm-rows", dest="warm_rows", type=int, default=120000)
    parser.add_argument("--seed", type=int, default=42)
    parser.add_argument("--skip-arf", dest="skip_arf", action="store_true")
    args = parser.parse_args()

    X_test = pd.read_csv(os.path.join(args.data_dir, "X_test.csv"))
    y_test = pd.read_csv(os.path.join(args.data_dir, "y_test.csv"))["Label_Multiclass"]
    meta = pd.read_csv(os.path.join(args.data_dir, "meta_test.csv"))

    positions = pick_pool(y_test, args.per_class, args.seed)
    sample = X_test.iloc[positions]
    labels = y_test.iloc[positions].tolist()
    sample_meta = meta.iloc[positions]
    print(f"[*] Pool: {len(positions):,} held-out flows across {y_test.nunique()} classes")

    models, predictions, confidences = {}, {}, {}
    for name, filename in MODEL_FILES.items():
        path = os.path.join(args.models_dir, filename)
        if not os.path.exists(path):
            print(f"[!] missing {path} -- skipping {name}")
            continue
        model = joblib.load(path)
        models[name] = model
        predictions[name] = model.predict(sample).tolist()
        confidences[name] = confidence_for(model, sample)
        hits = sum(1 for p, t in zip(predictions[name], labels) if p == t)
        print(f"    {name:<20} {hits}/{len(labels)} correct on the pool")

    arf = None
    if not args.skip_arf:
        arf = run_arf(args.unscaled_dir, positions, labels, args.warm_rows, args.seed)

    scaler_path = os.path.join(args.data_dir, "StandardScaler.pkl")
    scaler = joblib.load(scaler_path) if os.path.exists(scaler_path) else None
    readable = (pd.DataFrame(scaler.inverse_transform(sample), columns=X_test.columns,
                             index=sample.index) if scaler is not None else sample)

    # Packed layout. The feature spec and model names are identical across every
    # flow, so repeating them per flow tripled the bundle (3.4 MB -> 931 KB when
    # hoisted). Verdicts pack to
    # [label, group, correct, confidence?, runningAccuracy?, step?].
    feature_spec = [{"key": k, "label": l, "unit": u}
                    for k, l, u in DISPLAY_FEATURES if k in readable.columns]
    model_order = list(models) + (["ARF_ADWIN"] if arf is not None else [])
    model_slot = {name: str(i) for i, name in enumerate(model_order)}

    flows = []
    for position, index in enumerate(sample.index):
        truth = labels[position]
        row_meta = sample_meta.iloc[position]
        packed = {}
        for name in models:
            predicted = predictions[name][position]
            confidence = confidences[name][position]
            packed[model_slot[name]] = [
                predicted, group_of(predicted), int(predicted == truth),
                None if np.isnan(confidence) else round(float(confidence), 3),
            ]
        if arf is not None:
            verdict = arf[position]
            packed[model_slot["ARF_ADWIN"]] = [
                verdict["label"], verdict["group"], int(verdict["correct"]),
                None, verdict["runningAccuracy"], verdict["step"],
            ]

        flows.append({
            "id": int(index),
            "trueLabel": truth,
            "trueGroup": group_of(truth),
            "evse": str(row_meta["evse"]),
            "state": str(row_meta["state"]),
            "capture": str(row_meta["source_file"]),
            "v": [round(float(readable.loc[index, spec["key"]]), 3) for spec in feature_spec],
            "p": packed,
        })

    by_class = {}
    for flow in flows:
        by_class.setdefault(flow["trueLabel"], []).append(flow["id"])

    payload = {
        "generated": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "provenance": (
            "Held-out flows from the CICEVSE2024 test split. Static-model verdicts are the "
            "models' actual outputs. ARF + ADWIN verdicts are recorded from one prequential "
            "pass, so its accuracy reflects how much of the stream it had already seen."
        ),
        "benignNote": (
            "The dataset holds 81 benign flows; 69 are in the train split and were fitted on, "
            "so only the 12 held-out ones drive the idle baseline. They loop."
        ),
        "models": model_order,
        "featureSpec": feature_spec,
        "verdictSchema": ["label", "group", "correct", "confidence", "runningAccuracy", "step"],
        "onlineModels": ["ARF_ADWIN"] if arf is not None else [],
        "classes": sorted(y_test.unique().tolist()),
        "groups": {c: group_of(c) for c in sorted(y_test.unique().tolist())},
        "byClass": {k: v for k, v in sorted(by_class.items())},
        "flows": flows,
    }

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as handle:
        json.dump(payload, handle, separators=(",", ":"))
    print(f"\n[+] {args.out}  ({len(flows):,} flows, {len(model_order)} detectors, "
          f"{os.path.getsize(args.out)/1024:.0f} KB)")


if __name__ == "__main__":
    main()
