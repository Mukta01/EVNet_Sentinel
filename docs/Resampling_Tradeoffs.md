# Dataset Resampling Strategy & Trade-offs

## The Problem: Extreme Class Imbalance
The CICEVSE2024 dataset exhibits extreme class imbalance in its multiclass labels. For example, `syn-stealth` contains 371,662 samples, while `icmp-fragmentation` contains only 20 samples. When training machine learning models on this raw data, the models achieve artificially high accuracy by simply predicting the majority classes and completely ignoring the minority classes (resulting in F1-scores of 0.00 for minority attacks).

## The Solution: Hybrid Resampling
Due to the massive size of the dataset (2.4 GB, ~1.9 million rows), applying standard in-memory oversampling algorithms like SMOTE is computationally unfeasible under strict memory constraints (e.g., 500MB). 

To solve this, we implemented a memory-efficient **Hybrid Resampling Strategy** (`src/data/balance_dataset.py`):
- **Target Samples Per Class**: 75,000
- **Undersampling**: For classes with > 75,000 samples, we randomly select exactly 75,000 samples without replacement.
- **Oversampling**: For classes with < 75,000 samples, we randomly duplicate existing samples with replacement until they reach exactly 75,000.

This results in a perfectly balanced dataset (`X_train_balanced.csv`) of 1,125,000 samples (15 classes × 75,000).

## Trade-off Caveat: Overfitting on Extreme Minorities
While hybrid resampling dramatically improves the model's Macro F1-Score (allowing it to recognize minority classes), it introduces a critical trade-off: **Overfitting on extremely sparse classes**.

For a class like `icmp-fragmentation` (initial count: 20), duplicating those 20 samples to reach 75,000 means the model will heavily memorize those exact 20 patterns. While this improves validation metrics, the model's ability to generalize to *novel* patterns of `icmp-fragmentation` in the real world is severely limited by the lack of original variance in the training data.

This is an unavoidable trade-off when dealing with extreme scarcity in cybersecurity datasets.
