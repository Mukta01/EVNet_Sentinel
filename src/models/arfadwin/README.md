# Adaptive Random Forest with ADWIN (ARF+ADWIN)

This directory contains the online learning implementation for EVNet Sentinel, reproducing the core algorithm from Makhmudov et al. (2025).

## Overview

Unlike the static models (Decision Tree, SVM, Random Forest), this model learns **incrementally**. It processes the network traffic stream one instance at a time, predicting first and then learning from the true label. 

It uses **ADWIN (ADaptive WINdowing)** to detect concept drifts in the data stream and update its internal decision trees dynamically without needing to be fully retrained.

## Running the Model

### Development Mode (Subset)
To test the pipeline locally on a subset of the data (default: 50,000 rows), run:

```bash
python3 -m src.models.arfadwin.train_evaluate --input data/processed/X_train.csv
```

### Production Mode (Full Dataset)
To process the entire 2.74 million row dataset (this may take 1-2 hours depending on your hardware), use the `--full` flag:

```bash
python3 -m src.models.arfadwin.train_evaluate --input data/processed/X_train.csv --full
```

## Outputs
Running this script will generate three outputs:
1. `predictions/arf_adwin_predictions.csv`: The prequential predictions (`y_true`, `y_pred`) which can be fed directly into the unified evaluation script.
2. `predictions/arf_adwin_drift_events.json`: A log of all detected concept drifts, used by the Next.js dashboard for visualization.
3. `saved_models/arf_adwin.pkl`: The serialized `river` pipeline model weights.
