# `saved_models/`

**Model artifacts are not version-controlled.** They are large (the Random Forest
alone is 38 MB, the ARF pipelines up to 97 MB) and environment-specific.

## Why they were removed

`src/api/main.py` loads **every** `.pkl` in this directory into its model registry
and will serve predictions from any of them. Until issue #55, the models
committed here were trained on data containing the six absolute capture-timestamp
columns (#46) — so the API was silently serving a classifier whose reported
0.9994 accuracy was a timestamp lookup table rather than a detector.

The superseded files were moved to `saved_models/_superseded/` (gitignored) rather
than deleted, so the before/after comparison stays reproducible locally. Their
metrics are recorded in `evaluation_results/COMPARISON.md` and
`docs/leakage_audit_results.md`.

## Regenerating

```bash
# 1. build the corrected dataset
make data-process RAW_DIR=data/raw OUT_DIR=data/processed

# 2. train the static models
python3 src/models/random_forest/train_rf.py \
  --input_X_train data/processed/X_train.csv \
  --input_y_train data/processed/y_train.csv \
  --input_X_test  data/processed/X_test.csv
# ...and likewise for decision_tree/train_dt.py, svm/train_svm.py, log_reg/train_logreg.py

# 3. the online model (feed it UNSCALED features -- see src/models/arfadwin/README.md)
python3 src/data_prep/preprocess.py --raw_dir data/raw \
  --output_dir data/processed_unscaled --scale none
python3 -m src.models.arfadwin.train_arfadwin \
  --data-dir data/processed_unscaled --target multiclass --full
```

`preprocess.py` writes its fitted `StandardScaler.pkl` **beside the dataset it was
fitted on**, so a re-run cannot invalidate models trained against an earlier
version. Pass `--publish-scaler` to also copy it here for the API.
