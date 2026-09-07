"""
Adaptive Random Forest + ADWIN -- online IDS for EVCS network traffic.

Reproduces the method of Makhmudov et al. (2025), Mathematics 13(5):712.
This is the single canonical ARF implementation (issue #52); it replaces the
earlier `train_arfadwin.py` and `train_evaluate.py`, which had diverged.

What the previous entry point got wrong
---------------------------------------
The script the README linked used `n_models=5` with no ADWIN configuration,
stopped after 500,000 rows, trained on `y.iloc[:, 0]` (the *binary* column while
claiming to be multiclass), and never called `predict_one`. The paper's method
*is* the prequential test-then-learn loop with per-instance metric updates and
explicit drift detection; calling `learn_one` in a loop reproduces none of it.

Paper configuration (Section 5, Tables 3-4), reproduced exactly
--------------------------------------------------------------
    StandardScaler (streaming) | ARFClassifier(
        n_models=20, max_features=0.5, grace_period=30,
        leaf_prediction='nba', drift_detector=ADWIN(delta=0.002))
    standalone ADWIN(delta=0.002, clock=32, max_buckets=5,
                     min_window_length=5, grace_period=10)

Input expectations
------------------
Feed this **unscaled** features (`preprocess.py --scale none`). River's
StandardScaler is part of the pipeline and computes running statistics over the
stream; passing pre-scaled data would normalise twice.

Usage
-----
    python3 -m src.models.arfadwin.train_arfadwin \
        --data-dir data/processed_v2/extended-random-unscaled \
        --target multiclass --limit 50000

    # full stream, in capture order, for the drift-boundary experiment (#53)
    python3 -m src.models.arfadwin.train_arfadwin \
        --data-dir ... --target multiclass --full --stream-order file
"""

import argparse
import json
import os
import pickle
import time

import pandas as pd
from river import drift, forest, metrics, preprocessing

# Paper hyperparameters. Named constants so the reproduction is auditable.
ARF_N_MODELS = 20
ARF_MAX_FEATURES = 0.5
ARF_GRACE_PERIOD = 30
ARF_LEAF_PREDICTION = "nba"          # Naive Bayes Adaptive
ADWIN_DELTA = 0.002
ADWIN_CLOCK = 32
ADWIN_MAX_BUCKETS = 5
ADWIN_MIN_WINDOW_LENGTH = 5
ADWIN_GRACE_PERIOD = 10

TARGET_COLUMN = {"binary": "Label_Binary", "multiclass": "Label_Multiclass"}


def build_pipeline():
    """Construct the streaming scaler + ARF pipeline exactly as the paper specifies."""
    arf = forest.ARFClassifier(
        n_models=ARF_N_MODELS,
        max_features=ARF_MAX_FEATURES,
        grace_period=ARF_GRACE_PERIOD,
        leaf_prediction=ARF_LEAF_PREDICTION,
        drift_detector=drift.ADWIN(delta=ADWIN_DELTA),
        warning_detector=drift.ADWIN(delta=ADWIN_DELTA),
        seed=42,
    )
    return preprocessing.StandardScaler() | arf


def _load_stream(data_dir, split, target, stream_order, limit=None):
    """
    Load the stream as (features_frame, labels_series, metadata_frame).

    Orderings:

      file                Sort by capture timestamp: the stream arrives as it was
                          recorded. Needed for the #53 drift-boundary experiment.
      shuffled            The paper's own default.
      file-then-shuffle   Take the first `limit` rows in capture order, then
                          shuffle only those. This is the controlled comparison
                          against `file`: identical instances and identical class
                          distribution, differing *only* in order, which isolates
                          label autocorrelation from task difficulty.
      asis                Leave the file order untouched.
    """
    X = pd.read_csv(os.path.join(data_dir, f"X_{split}.csv"))
    y = pd.read_csv(os.path.join(data_dir, f"y_{split}.csv"))[TARGET_COLUMN[target]]

    meta_path = os.path.join(data_dir, f"meta_{split}.csv")
    meta = pd.read_csv(meta_path) if os.path.exists(meta_path) else pd.DataFrame(index=X.index)

    if stream_order in ("file", "file-then-shuffle"):
        if "capture_timestamp_ms" not in meta.columns:
            raise ValueError(f"--stream-order {stream_order} needs capture_timestamp_ms metadata (#50).")
        order = meta["capture_timestamp_ms"].sort_values(kind="stable").index
        X, y, meta = X.loc[order], y.loc[order], meta.loc[order]

    if stream_order == "file-then-shuffle":
        # Truncate first, so the shuffled run sees exactly the instances the
        # capture-order run saw -- same classes, same proportions, order alone.
        if limit is not None:
            X, y, meta = X.iloc[:limit], y.iloc[:limit], meta.iloc[:limit]
        X = X.sample(frac=1.0, random_state=42)
        y, meta = y.loc[X.index], meta.loc[X.index]
    elif stream_order == "shuffled":
        X = X.sample(frac=1.0, random_state=42)
        y, meta = y.loc[X.index], meta.loc[X.index]

    return X.reset_index(drop=True), y.reset_index(drop=True), meta.reset_index(drop=True)


def run(data_dir, split, target, limit, output_dir, model_save_dir, stream_order, model_name):
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(model_save_dir, exist_ok=True)

    print(f"[*] Loading '{split}' stream from {data_dir} (order: {stream_order})...")
    X, y, meta = _load_stream(data_dir, split, target, stream_order, limit)
    if limit is not None:
        X, y, meta = X.iloc[:limit], y.iloc[:limit], meta.iloc[:limit]
    print(f"[*] Stream: {len(X)} instances, {X.shape[1]} features, {y.nunique()} classes.")

    model = build_pipeline()

    # Standalone ADWIN over the accuracy signal, matching the paper's Step 4.
    drift_detector = drift.ADWIN(
        delta=ADWIN_DELTA,
        clock=ADWIN_CLOCK,
        max_buckets=ADWIN_MAX_BUCKETS,
        min_window_length=ADWIN_MIN_WINDOW_LENGTH,
        grace_period=ADWIN_GRACE_PERIOD,
    )

    # Weighted averaging throughout, as the paper does, to respect class imbalance.
    tracked = {
        "accuracy": metrics.Accuracy(),
        "precision": metrics.WeightedPrecision(),
        "recall": metrics.WeightedRecall(),
        "f1": metrics.WeightedF1(),
    }

    has_provenance = "source_file" in meta.columns
    source_files = meta["source_file"].tolist() if has_provenance else None

    y_true, y_pred = [], []
    drift_events = []
    metric_seconds = 0.0
    drift_seconds = 0.0

    feature_records = X.to_dict(orient="records")
    labels = y.tolist()

    print("[*] Starting prequential (test-then-learn) run...")
    started = time.perf_counter()

    for i, (x, label) in enumerate(zip(feature_records, labels)):
        # Step 1 -- predict before learning.
        prediction = model.predict_one(x)
        y_true.append(label)
        y_pred.append(prediction if prediction is not None else label)

        if prediction is not None:
            # Step 2 -- update running metrics.
            t0 = time.perf_counter()
            for metric in tracked.values():
                metric.update(label, prediction)
            metric_seconds += time.perf_counter() - t0

            # Step 3 -- drift detection over the correctness signal.
            t0 = time.perf_counter()
            drift_detector.update(1.0 if label == prediction else 0.0)
            detected = drift_detector.drift_detected
            drift_seconds += time.perf_counter() - t0

            if detected:
                event = {
                    "instance": i,
                    "accuracy_at_drift": tracked["accuracy"].get(),
                    "elapsed_seconds": round(time.perf_counter() - started, 3),
                }
                if has_provenance:
                    # Recorded for #53: are drift events just capture-file seams?
                    event["source_file"] = source_files[i]
                drift_events.append(event)
                print(f"[!] Drift at instance {i:>9,}  acc={tracked['accuracy'].get():.4f}"
                      + (f"  capture={source_files[i]}" if has_provenance else ""))

        # Step 4 -- learn from the instance.
        model.learn_one(x, label)

        if (i + 1) % 25000 == 0:
            rate = (i + 1) / (time.perf_counter() - started)
            print(f"    {i + 1:>9,} instances | acc={tracked['accuracy'].get():.4f} "
                  f"| {rate:,.0f} inst/s")

    total_seconds = time.perf_counter() - started
    processed = len(y_true)

    print(f"\n[*] Processed {processed:,} instances in {total_seconds:.1f}s "
          f"({total_seconds / processed * 1000:.3f} ms/instance)")
    for name, metric in tracked.items():
        print(f"    {name:<10} {metric.get():.4f}")
    print(f"    drift events detected: {len(drift_events)}")

    preds_path = os.path.join(output_dir, f"{model_name}_preds_{target}.csv")
    pd.DataFrame({"y_true": y_true, "y_pred": y_pred}).to_csv(preds_path, index=False)
    print(f"[+] Predictions -> {preds_path}")

    drift_path = os.path.join(output_dir, f"{model_name}_drift_events_{target}.json")
    with open(drift_path, "w") as handle:
        json.dump({
            "stream_order": stream_order,
            "instances": processed,
            "target": target,
            "events": drift_events,
            "timing_seconds": {
                "total": round(total_seconds, 3),
                "metric_updates": round(metric_seconds, 3),
                "drift_detection": round(drift_seconds, 3),
                "mean_per_instance": round(total_seconds / processed, 6),
            },
            "final_metrics": {name: metric.get() for name, metric in tracked.items()},
        }, handle, indent=2)
    print(f"[+] Drift log  -> {drift_path}")

    model_path = os.path.join(model_save_dir, f"{model_name}_{target}.pkl")
    with open(model_path, "wb") as handle:
        pickle.dump(model, handle)
    print(f"[+] Model      -> {model_path}")


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data-dir", dest="data_dir", default="data/processed",
                        help="Directory holding X_*.csv / y_*.csv / meta_*.csv (UNSCALED)")
    parser.add_argument("--split", default="train", choices=["train", "val", "test"],
                        help="Prequential learning consumes one continuous stream; 'train' by default.")
    parser.add_argument("--target", default="multiclass", choices=["binary", "multiclass"])
    parser.add_argument("--limit", type=int, default=50000,
                        help="Instances to process. Ignored when --full is given.")
    parser.add_argument("--full", action="store_true", help="Process the entire stream.")
    parser.add_argument("--stream-order", dest="stream_order", default="shuffled",
                        choices=["shuffled", "file", "file-then-shuffle", "asis"],
                        help="'file' replays captures in recorded order (needed for #53); "
                             "'file-then-shuffle' is its controlled counterpart.")
    parser.add_argument("--output-dir", dest="output_dir", default="predictions")
    parser.add_argument("--model-save-dir", dest="model_save_dir", default="saved_models")
    parser.add_argument("--model-name", dest="model_name", default="arf_adwin")
    args = parser.parse_args()

    run(args.data_dir, args.split, args.target,
        None if args.full else args.limit,
        args.output_dir, args.model_save_dir, args.stream_order, args.model_name)


if __name__ == "__main__":
    main()
