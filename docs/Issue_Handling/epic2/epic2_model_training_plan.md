# EPIC 2: Model Training Implementation Plan (Revised)

This document outlines the detailed step-by-step implementation strategy for Epic 2 (Issue #13). Epic 2 requires all team members to build, train, and save baseline Machine Learning models. 

**Revision Note 1**: Based on feedback, each collaborator will train their assigned model focusing exclusively on the Multiclass classification task (`Label_Multiclass`). The Binary classification task has been dropped as the target variable is 99.99% 'Attack', making it redundant compared to identifying the specific attack types.
**Revision Note 2 (OOM Mitigation)**: Due to massive memory consumption (50GB+ OOM errors) on 2.4 GB datasets with `LinearSVC`, the **SVM** and **Logistic Regression** models have been architecturally refactored to use **Out-of-Core Learning**. Instead of `LinearSVC` and `LogisticRegression`, both will use `SGDClassifier` (`loss='hinge'` for SVM, `loss='log_loss'` for Logistic Regression) coupled with `pd.read_csv(chunksize=X)` and `.partial_fit()` to strictly bound memory < 500MB.

## 1. Overview & Collaborator Assignments

| Assignee | Model | Issue | Output Models (`saved_models/`) | Output Preds (`predictions/`) | Branch |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Shardul (@shard-c6)** | Support Vector Machine (SVM) | #2 | `svm_model_multiclass.pkl` | `svm_preds_multiclass.csv` | `feature/svm-model` |
| **Mukta (@Mukta01)** | Logistic Regression | #3 | `logreg_model_multiclass.pkl`| `logreg_preds_multiclass.csv`| `feature/logreg-model` |
| **Shruti (@shrutich-30)** | Random Forest | #4 | `rf_model_multiclass.pkl` | `rf_preds_multiclass.csv` | `feature/rf-model` |
| **Neha (@nehachavhan2006)** | Decision Tree | #5 | `dt_model_multiclass.pkl` | `dt_preds_multiclass.csv` | `feature/dt-model` |

---

## 2. Universal Rules for Epic 2

All collaborators must strictly follow these rules to ensure integration with Epic 3 (Web/API) and Epic 4 (Evaluation):

1. **No Data Modification**: You must load `X_train.csv`, `X_test.csv`, `y_train.csv`, and `y_test.csv` from `data/processed/`. **Do not** apply any scaling or preprocessing in your scripts. This was already handled in Epic 1.
2. **Script Location**: Place your Python training script in the `src/models/` directory (e.g., `src/models/train_svm.py`).
3. **Reproducibility**: Always use `random_state=42` when instantiating your models (where applicable, e.g., RF and DT) so our results are perfectly reproducible.
4. **Serialization**: You must save your trained models using the `joblib` library to the `saved_models/` directory.

---

## 3. Step-by-Step Implementation Guide

Each collaborator will create a script in `src/models/` following this structure:

### Step 1: Load the Processed Data
Using pandas, load the feature sets and the two label sets.
```python
import pandas as pd
import os
import joblib

# 1. Load Data
X_train = pd.read_csv("data/processed/X_train.csv")
y_train = pd.read_csv("data/processed/y_train.csv")

X_test = pd.read_csv("data/processed/X_test.csv")

# Separate the targets
y_train_binary = y_train["Label_Binary"]
y_train_multi = y_train["Label_Multiclass"]
```

### Step 2: Initialize and Train the Models
Initialize two instances of your specific model from `scikit-learn`.
*Example for Random Forest (Shruti):*
```python
from sklearn.ensemble import RandomForestClassifier

# 2. Train Models
# Binary Model
model_binary = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
model_binary.fit(X_train, y_train_binary)

# Multiclass Model
model_multi = RandomForestClassifier(n_estimators=100, random_state=42, n_jobs=-1)
model_multi.fit(X_train, y_train_multi)
```

### Step 3: Save the Models
Serialize both models so they can be loaded later for the Web Dashboard (Epic 3).
```python
# 3. Save Models
os.makedirs("saved_models", exist_ok=True)
joblib.dump(model_binary, "saved_models/rf_model_binary.pkl")
joblib.dump(model_multi, "saved_models/rf_model_multiclass.pkl")
```

### Step 4: Generate and Save Predictions
Predict on the `X_test.csv` set and save the results in separate CSVs.
```python
# 4. Generate Predictions
y_pred_binary = model_binary.predict(X_test)
y_pred_multi = model_multi.predict(X_test)

# Save to CSV
os.makedirs("predictions", exist_ok=True)

# Binary Predictions
preds_binary_df = pd.DataFrame({"Prediction_Binary": y_pred_binary})
preds_binary_df.to_csv("predictions/rf_preds_binary.csv", index=False)

# Multiclass Predictions
preds_multi_df = pd.DataFrame({"Prediction_Multiclass": y_pred_multi})
preds_multi_df.to_csv("predictions/rf_preds_multiclass.csv", index=False)
```

## 4. Workflows & PR Strategy

Each collaborator must execute the following Git workflow:
1. Check out the latest `main` branch.
2. Create your assigned feature branch (e.g., `git checkout -b feature/svm-model`).
3. Create your script in `src/models/`.
4. Run your script to ensure the 4 output files (2 `.pkl`, 2 `.csv`) are generated locally.
5. **DO NOT** commit the `.pkl` or `.csv` files (ensure they are in `.gitignore`). Only commit your Python script!
6. Open a Pull Request referencing your issue number (e.g., "Resolves #2").

## Execution Step

> [!IMPORTANT]
> Once you approve this revised plan, I will immediately copy its contents into a permanent file at `docs/Issue_Handling/epic2/epic2_model_training_plan.md` and commit it to a new branch, opening a PR so the collaborators can use it as a reference.
