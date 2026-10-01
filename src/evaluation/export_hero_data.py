"""
Export the data behind the landing page's "Tune the detector" control.

The control asks: how sure must the model be before it names an attack? Below
that bar it reports only the category (denial of service or reconnaissance),
which is how the response guidance already behaves when a name is unreliable.
Raising the bar trades wrong names for category-only answers.

For each model, every held-out attack flow in a stratified sample over all
three seeds is scored with its top-class probability and whether that top class
is correct. Histograms of the top probability, split by attack category and by
correct / wrong, let the page compute for any bar t:

    named correctly   top class right, probability >= t
    named wrongly     top class wrong, probability >= t
    category only     probability < t

A sensitivity slider on P(benign) was the first design and was dropped: every
attack flow scores P(benign) ~ 0, so detection stays at 100% at any setting.

Only models whose probabilities agree with their own predictions are included.
SVM (hinge loss) has no probability output. Logistic Regression's multiclass
predict_proba saturates, so its most-probable class often differs from what
predict() returns (7 of 12 benign flows on seed 1337); a control built on it
would misstate the deployed model. The agreement check below enforces this.

Writes frontend/data/hero.json. Needs saved_models/multiseed and data/multiseed
(src/evaluation/run_experiments.py).

Usage
-----
    python3 src/evaluation/export_hero_data.py
"""

import argparse
import json
import os
import sys

import joblib
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from attack_test_harness import category  # noqa: E402

MODELS = {"RandomForest": "rf", "DecisionTree": "dt"}
BINS = 100


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--seeds", type=int, nargs="+", default=[42, 1337, 2024])
    parser.add_argument("--data-root", default="data/multiseed")
    parser.add_argument("--models-root", default="saved_models/multiseed")
    parser.add_argument("--per-class", type=int, default=300, help="Attack flows sampled per class per seed")
    parser.add_argument("--stream", type=int, default=64, help="Flows kept for the animated stream")
    parser.add_argument("--out", default="frontend/data/hero.json")
    args = parser.parse_args()

    rng = np.random.RandomState(0)
    out = {"bins": BINS, "seeds": args.seeds, "models": {}}
    hist = lambda v: np.histogram(v, bins=BINS, range=(0, 1))[0].tolist()  # noqa: E731
    for name, slug in MODELS.items():
        top, correct, cats, false_alarm, stream = [], [], [], [], []
        for seed in args.seeds:
            X = pd.read_csv(os.path.join(args.data_root, f"seed-{seed}", "X_test.csv"))
            y = pd.read_csv(os.path.join(args.data_root, f"seed-{seed}", "y_test.csv"))["Label_Multiclass"].to_numpy()
            model = joblib.load(os.path.join(args.models_root, f"seed-{seed}", f"{slug}_model_multiclass.pkl"))

            rows = []
            for cls in np.unique(y):
                idx = np.flatnonzero(y == cls)
                if cls != "Benign" and len(idx) > args.per_class:
                    idx = rng.choice(idx, args.per_class, replace=False)
                rows.extend(idx)
            rows = np.array(sorted(rows))
            proba = model.predict_proba(X.iloc[rows])
            predicted = model.classes_[proba.argmax(axis=1)]
            agree = (model.predict(X.iloc[rows]) == predicted).mean()
            assert agree > 0.999, f"{name} seed {seed}: probabilities disagree with predict() on {1 - agree:.1%}"

            truth = y[rows]
            benign = truth == "Benign"
            false_alarm.append(predicted[benign] != "Benign")
            attack = ~benign
            top.append(proba.max(axis=1)[attack])
            correct.append(predicted[attack] == truth[attack])
            cats.append(np.array([category(c) for c in truth[attack]]))
            if seed == args.seeds[0]:
                pick = rng.choice(np.flatnonzero(attack), args.stream, replace=False)
                stream = [{"label": str(truth[i]), "called": str(predicted[i]),
                           "p": round(float(proba[i].max()), 3)} for i in pick]

        top, correct, cats = np.concatenate(top), np.concatenate(correct), np.concatenate(cats)
        entry = {"falseAlarm": round(float(np.concatenate(false_alarm).mean()), 4),
                 "benignN": int(np.concatenate(false_alarm).size), "stream": stream, "categories": {}}
        for cat in ("dos", "recon"):
            m = cats == cat
            entry["categories"][cat] = {
                "n": int(m.sum()),
                "rightHist": hist(top[m & correct]),
                "wrongHist": hist(top[m & ~correct]),
            }
            print(f"[*] {name} {cat}: {m.sum():,} flows, named right at default {correct[m].mean():.1%}")
        out["models"][name] = entry

    with open(args.out, "w") as handle:
        json.dump(out, handle, separators=(",", ":"))
    print(f"[+] {args.out}  ({os.path.getsize(args.out) / 1024:.0f} KB)")


if __name__ == "__main__":
    main()
