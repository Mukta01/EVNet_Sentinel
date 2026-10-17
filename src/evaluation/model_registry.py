"""
The detectors every evaluation script and exporter knows about, in display order.

Adding a model means adding it here once; the attack harness, the dashboard
exporters and the simulation bundle all read this list. XGBoost and LightGBM are
trained separately (run_boosting.py) on the same splits as the others, so
load_multiseed() folds their results into the multiseed record.
"""

import json
import os

MODEL_FILES = {
    "RandomForest": "rf_model_multiclass.pkl",
    "DecisionTree": "dt_model_multiclass.pkl",
    "XGBoost": "xgb_model_multiclass.pkl",
    "LightGBM": "lgbm_model_multiclass.pkl",
    "LogisticRegression": "logreg_model_multiclass.pkl",
    "SVM": "svm_model_multiclass.pkl",
}

LABEL = {
    "RandomForest": "Random Forest", "DecisionTree": "Decision Tree",
    "XGBoost": "XGBoost", "LightGBM": "LightGBM",
    "LogisticRegression": "Logistic Regression", "SVM": "SVM",
}

BOOSTING_RAW = "evaluation_results/boosting/boosting_raw.json"


def load_multiseed(path, boosting_path=BOOSTING_RAW):
    """multiseed_raw.json, with the boosted models merged into each seed if present."""
    raw = json.load(open(path))
    if boosting_path and os.path.exists(boosting_path):
        boost = json.load(open(boosting_path))
        by_seed = {r["seed"]: r["models"] for r in boost["per_seed"]}
        for seed, run in zip(raw["seeds"], raw["per_seed"]):
            extra = by_seed.get(seed)
            if extra is None:
                continue
            merged = {**run["models"], **extra}
            run["models"] = {k: merged[k] for k in MODEL_FILES if k in merged}
    return raw
