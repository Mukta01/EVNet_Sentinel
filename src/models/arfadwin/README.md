# Adaptive Random Forest with ADWIN (ARF+ADWIN)

The online-learning implementation for EVNet Sentinel, reproducing the core
algorithm from Makhmudov et al. (2025), *Mathematics* 13(5):712.

Unlike the static models, this one learns **incrementally**: it processes the
stream one instance at a time, predicting *before* it sees the true label
(prequential, or test-then-learn), and uses **ADWIN** to detect concept drift
and retire underperforming trees without a full retrain.

## Consolidation note (issue #52)

This directory previously held three divergent implementations. `train_arfadwin.py`
is now the single entry point; `train_evaluate.py` and `evaluate_arfadwin.py` were
removed. The old `train_arfadwin.py` was the one the root README linked, and it
reproduced almost nothing of the paper's method: `n_models=5`, no ADWIN
configuration, a hard stop at 500,000 rows, training on `y.iloc[:, 0]` — the
*binary* column, while labelled multiclass — and no `predict_one` call at all.

`ARF_ADWIN_Training.ipynb` is still present and still unexecuted; see #52.

## Configuration

Reproduced exactly from the paper's Tables 3–4:

| Component | Parameter | Value |
|---|---|---|
| ARF | `n_models` | 20 |
| | `max_features` | 0.5 |
| | `grace_period` | 30 |
| | `leaf_prediction` | `nba` (Naïve Bayes Adaptive) |
| | `drift_detector` | `ADWIN(delta=0.002)` |
| Standalone ADWIN | `delta` | 0.002 |
| | `clock` | 32 |
| | `max_buckets` | 5 |
| | `min_window_length` | 5 |
| | `grace_period` | 10 |

## Input: feed it UNSCALED features

River's `StandardScaler` is part of the pipeline and computes running statistics
over the stream, exactly as the paper specifies. Passing pre-scaled data would
normalise twice. Generate a suitable dataset with:

```bash
python3 src/data_prep/preprocess.py --raw_dir data/raw \
  --output_dir data/processed_unscaled --scale none
```

## Running

```bash
# development: 50k instances
python3 -m src.models.arfadwin.train_arfadwin \
  --data-dir data/processed_unscaled --target multiclass --limit 50000

# full stream
python3 -m src.models.arfadwin.train_arfadwin \
  --data-dir data/processed_unscaled --target multiclass --full
```

## Stream ordering matters more than anything else here

`--stream-order` controls how the stream is sequenced, and it dominates the
results. Measured on an identical 25,000-instance slice with leak-free features:

| `--stream-order` | Accuracy | Weighted F1 | Drift events |
|---|---|---|---|
| `file` (capture order) | 0.9976 | 0.9975 | 3 |
| `shuffled` (paper default) | 0.5029 | 0.4909 | 1 |

In capture order consecutive instances share a label, so a prequential learner
scores near-perfectly by predicting "the same as recently" — label
autocorrelation, an inflation mechanism entirely separate from the timestamp
leak of #46. Use `file-then-shuffle` for the controlled comparison against
`file`: it takes the same instances with the same class distribution and varies
only the order.

All three drift events in the `file` run landed on capture-file names, which is
the evidence #53 was designed to gather.

## Outputs

1. `predictions/arf_adwin_preds_{target}.csv` — prequential `y_true` / `y_pred`,
   consumable by `src/evaluation/evaluate_model.py`.
2. `predictions/arf_adwin_drift_events_{target}.json` — every drift event with
   its instance index, running accuracy, elapsed time and, when provenance is
   available, the **capture file** it fired in. Also carries the paper's timing
   breakdown (total, metric-update, drift-detection, mean per instance).
3. `saved_models/arf_adwin_{target}.pkl` — the serialized River pipeline.
