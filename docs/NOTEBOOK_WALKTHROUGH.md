# Notebook walkthrough

A cell-by-cell explanation of the five training notebooks: the four static models and ARF + ADWIN. For each cell it covers what the code does, what output to expect, and what to say. Cell numbers count every cell, markdown included, from the top of the notebook.

| Notebook | Model | Cells |
|---|---|---|
| `src/models/random_forest/Random_Forest_Training.ipynb` | Random Forest | 26 |
| `src/models/decision_tree/Decision_Tree_Training.ipynb` | Decision Tree | 26 |
| `src/models/log_reg/Logistic_Regression_Training.ipynb` | Logistic Regression | 27 |
| `src/models/svm/svm_training.ipynb` | Linear SVM | 26 |
| `src/models/arfadwin/ARF_ADWIN_Training.ipynb` | Adaptive Random Forest + ADWIN (online) | 28 |

> **Before the demo: the committed notebooks have no saved outputs.** Run them once and save them, or the professor will see empty cells. Running times differ a lot:
> - Logistic Regression and SVM take a few minutes.
> - Random Forest and Decision Tree run a **grid search** (9 and 12 settings, each with 3-fold cross-validation on about 838k rows). That can take a long time on a laptop.
> - ARF + ADWIN processes flows one at a time. At the default `MAX_ROWS = 500000`, expect tens of minutes.
>
> Alternatively, show the cells and describe the outputs using the expected values below.

> **Which numbers to quote.** Each notebook runs **one seed** and is for exploration. The numbers in the paper come from `src/evaluation/run_experiments.py`: 3 seeds, fixed hyperparameters, mean ± std. The notebooks' last cell says the same. If a notebook prints a slightly different score, that is expected.

---

## Part 1: Cells shared by the four static notebooks

All four static notebooks follow the same structure. Explain these cells once, on the first notebook you show. On the others, skip ahead to the model-specific cells in Part 2.

| Section | What the code does | Expected output | What to say |
|---|---|---|---|
| **Title (markdown)** | States the dataset, the 60 features, the 1.2M rows, the multiclass-only task and macro-F1 as the headline metric | — | "This model is trained on the leak-corrected data. Binary attack-vs-benign was dropped because there are only about 80 benign flows, so always predicting 'attack' would win." |
| **Imports** | pandas, NumPy, scikit-learn, matplotlib and seaborn; sets the plot style | Nothing | Setup only. |
| **1. Load Data** | Finds `data/processed` and reads `X_train/val/test.csv` and `y_*.csv`. `X` holds the 60 features; `y` holds the label. | `Using data directory: …` | "These files come from `preprocess.py`: deduplicated, split 70/15/15, and scaled using training-set statistics only." |
| **Leakage guard** | Lists the seven leaking columns (six `*_seen_ms` timestamps and `src_port`) and **stops the notebook with an error** if any is present. Then counts the relative-timing features that are kept. | `Leakage guard passed — 60 features, none of them capture fingerprints.` and `Relative timing features retained: N` | "A safety check: if anyone runs this on the old leaky data, the notebook refuses to continue. Absolute timestamps say *when* a file was recorded; durations and gaps between packets (`*_duration_ms`, `*_piat_ms`) describe *how* the traffic behaves, so those stay." |
| **1.1 Dataset overview** | Prints the shapes, data types, missing values and summary statistics of the first 10 features | Train about 838,705 × 60, validation and test about 179,723 × 60; all numeric; no missing values; means ≈ 0 and std ≈ 1 | "The data is clean, and the means near 0 and standard deviations near 1 confirm it has been standardised." |
| **1.2 Split sizes** | A bar chart of the train/validation/test row counts | 70% / 15% / 15% | "The split is stratified, so every class appears in all three parts in the same proportions." |
| **1.3 Class distribution** | A horizontal bar chart of label counts in the training set. The SVM notebook colours the bars by family: floods, scans, other. | The four big floods have about 135k–180k each; scans about 19k–27k; Slowloris about 1.9k; ICMP and benign only a few dozen | "Heavily imbalanced. That's why we use **balanced class weights** and **macro-F1**: accuracy would just reflect the floods." |
| **1.4 Correlation heatmap** | Pearson correlations between the 30 highest-variance features (lower triangle) | Large red blocks: packet counts, byte counts and their per-direction versions move together | "Many features are near-duplicates. It also explains why permutation importance failed later: shuffle one feature and its twin carries the same information." |
| **1.5 Box plots** | The spread of the 10 highest-variance features on a 10,000-row sample | Narrow boxes with long whiskers and many outliers | "Floods produce extreme values, while most flows sit near the median. Tree models handle that skew naturally." |
| **Evaluation function** | `evaluate_model()` prints accuracy, macro-F1 and weighted F1, a per-class report and a confusion-matrix heatmap | — | "We print macro-F1 first. The function's own comment says why: accuracy is inflated by the floods." |
| **Save model** | Writes a `*_model_multiclass.pkl` into `saved_models/` | `Model saved …` | "This is the notebook's copy. The API serves the multi-seed models from `saved_models/multiseed/`." |
| **Where the canonical numbers live** | Points to `run_experiments.py`, `MULTISEED_RESULTS.md` and the leakage audit | — | "The notebook is for exploration. The paper's numbers come from the 3-seed run." |

### How to read the per-class report and the confusion matrix

- **The per-class report:**
  - *precision*: of the flows predicted as this class, how many really were.
  - *recall*: of the real flows of this class, how many were found.
  - *f1*: the balance of the two.
  - *support*: how many test flows the class has.
- **Look for two blocks:**
  - Floods: about 0.999+ F1. Say "near-perfect", never "1.00"; see [WEBSITE_WALKTHROUGH.md](WEBSITE_WALKTHROUGH.md#presenting-the-flood-result).
  - Scans: roughly 0.1–0.3.
- **Confusion matrix:** rows are the actual class, columns the predicted class, and the diagonal is correct. The six scan rows smear across each other's columns, and partly into Slowloris. That's the scan ceiling.

---

## Part 2: Model-specific cells

### Random Forest (`Random_Forest_Training.ipynb`)

| Cell | Section | What it does | What to say |
|---|---|---|---|
| 1 | Title | Includes the "What changed" note: with the leak, this model scored 0.9994 accuracy; without it, 0.5582 ± 0.0080 macro-F1 | "This note is the whole story of the project in two numbers." |
| 16–17 | **2. Hyperparameter tuning** | `GridSearchCV` over `n_estimators` ∈ {50, 100, 200} and `max_depth` ∈ {10, 15, None}. Uses 3-fold cross-validation **on the training set only**, scored by macro-F1, with `class_weight='balanced'`. | "Tuning never sees the test set. The grid optimises macro-F1, not accuracy." The output prints the best parameters and the best CV macro-F1. The paper's fixed setting is 100 trees, depth 15. |
| 20–21 | **4. Evaluate** | Validation report, then test report, each with a confusion matrix | Expect macro-F1 around 0.55 and accuracy around 0.87, with floods near 0.999 and scans around 0.1–0.27. "Same model, two very different-looking numbers. That's why we lead with macro-F1." |
| 22–23 | **5. Feature importance** | The top 20 features by Gini importance | Expect packet-timing, port and packet-size features near the top; check the actual output before presenting. "**No absolute timestamp appears**, which is the point of the correction." Add: "Gini importance is model-based and biased toward high-variance features. For the scans we use mutual information instead (Fig. 4 in the paper)." |
| 24–25 | 6. Save | Writes `rf_model_multiclass.pkl` | — |

### Decision Tree (`Decision_Tree_Training.ipynb`)

| Cell | Section | What it does | What to say |
|---|---|---|---|
| 1 | Title | The **"Why depth matters"** note: a deep tree once seemed to beat Random Forest (0.6834 vs 0.5894) by memorising `src_port` bands | "This was Finding 5. With `src_port` removed, the tree and the forest converge (0.557 vs 0.558)." |
| 16–17 | **2. Tuning** | Grid over `max_depth` ∈ {10, 15, 20, None} and `min_samples_split` ∈ {2, 5, 10}, scored by macro-F1. Prints the tree's depth and number of leaves. | "Depth limits memorisation. A very deep tree with thousands of leaves is a warning sign on data with fingerprints." |
| 18–21 | **3. Evaluation** | Separate cells for validation and test | Results are close to Random Forest. "One tree does as well as a forest here. But in our harness its confidence is a coarser signal, so the forest raises fewer false alarms (2% vs 12%)." |
| 22–23 | 4. Feature importance | The top 20 by Gini | A single tree concentrates importance on fewer features than the forest does. |
| 24–25 | 5. Save | Writes the model and a predictions CSV | — |

### Logistic Regression (`Logistic_Regression_Training.ipynb`)

| Cell | Section | What it does | What to say |
|---|---|---|---|
| 1–2 | `%pip install` | Installs requirements and ipywidgets (for the progress bar) | Setup. These two cells are the only ones with saved output, just pip logs. **Clear them before the demo.** |
| 3 | Title | "The linear control in the leakage finding" | "A linear model can't carve a timestamp into one interval per file, so the leak barely helped it. That makes it the control group." |
| 6 | Load data | Loads the labels fully but only a **sample** of `X_train` for the plots; the full file is about 2.4 GB | "Memory-aware: the plots use a sample, and training streams the full file." |
| 18–19 | **2. Class weights** | `compute_class_weight('balanced')` gives weight = N / (K × n_k) and prints it per class | "Rare classes get large weights (ICMP, benign) and the floods small ones, so every class counts equally in training (Eq. 11 in the paper)." |
| 20 | **Out-of-core training** | `SGDClassifier(loss='log_loss')` is logistic regression trained by stochastic gradient descent. `partial_fit` reads 100k-row chunks with a progress bar. | "This handles data bigger than RAM. Log loss makes it logistic regression; the progress bar shows chunks streaming through." |
| 21–24 | 3. Evaluation | Validation and test | Expect macro-F1 around 0.44 and accuracy around 0.86. "Linear boundaries can't separate the scans, and on the few benign flows it raises many false alarms (46% in the harness)." |
| 25–26 | 4. Save | Writes the model and a predictions CSV | — |

Also say: *"Its probabilities saturate, so we exclude it from confidence-gated naming."*

### Linear SVM (`svm_training.ipynb`)

| Cell | Section | What it does | What to say |
|---|---|---|---|
| 1 | Title | "Binary classification was removed": 82 benign flows; a test asserts that no binary model exists | "We removed a misleading task instead of reporting a meaningless score." |
| 10–11 | 1.3 Class distribution | Bars coloured by family: green floods, orange scans, grey other | "The colours preview the finding: green will be solved, orange won't." |
| 16–17 | **2. Train** | `SGDClassifier(loss='hinge')` is a linear SVM. For speed in the notebook it fits on a **200k-row subsample**, with balanced weights. The script `train_svm.py` trains on all 838k rows out-of-core. | "`LinearSVC` ran out of memory on the full data, so we use the same model trained by SGD. The notebook subsamples to stay interactive." |
| 20–23 | 4–5. Evaluate | Validation and test | Expect macro-F1 around 0.41, the lowest. "Its false-alarm rate is the worst (59%), which rules it out as the primary detector." |
| 24–25 | 6. Save | Multiclass model only | — |

---

## Part 3: ARF + ADWIN (`ARF_ADWIN_Training.ipynb`), cell by cell

This notebook is different: the model learns **online**, one flow at a time, as in the paper we reproduce.

| Cell | Section | What it does | Expected output | What to say |
|---|---|---|---|---|
| 1 | Title | The configuration: 20 trees, `max_features = 0.5`, `grace_period = 30`, Naive Bayes Adaptive leaves, ADWIN(δ = 0.002). The box warns: **feed it unscaled data.** | — | "These are exactly the paper's settings. River's scaler normalises on the fly, so pre-scaled data would be normalised twice." |
| 2 | Imports | River (`forest`, `preprocessing`, `drift`, `metrics`) plus scikit-learn metrics | — | "River is a Python library for online machine learning." |
| 3–4 | **1. Load data** | Prefers `data/processed_unscaled`, and prints a **WARNING** if it falls back to scaled data. Loads the labels and a 50k-row sample for plots. | `Using data directory: …processed_unscaled` | "If you see the warning, the results aren't comparable to the paper." |
| 5 | Leakage guard | Same as in the static notebooks | `Leakage guard passed …` | Same message. |
| 6–15 | 1.1–1.5 Overview, split, classes, heatmap, box plots | Same plots as the static notebooks, computed on the sample | Similar to above. The box plots are titled "Scaled Data", but here the data is unscaled, so expect raw units with a much larger range. | Point out that the scale differs from the static notebooks. That's expected. |
| 16–17 | **2. Initialise ARF + ADWIN** | Builds `StandardScaler | ARFClassifier(...)` (`|` chains the two into one pipeline). Each tree has its own ADWIN drift and warning detectors, and one extra ADWIN on the error stream is used for logging. | `ARF-ADWIN pipeline initialized. Trees: 20 …` | "Each tree watches its own error rate. When ADWIN detects a change, a background tree starts and replaces the stale one. That's how ARF adapts to drift." |
| 18–19 | **3. Prequential loop** | Reads the training CSV in 10k-row chunks. For **each flow**: **predict** → record it → update accuracy → feed correct/incorrect to the logging ADWIN (log an event if it fires) → **learn**. Stops at `MAX_ROWS = 500000`; set it to `None` for the full stream. | Progress every 5 chunks: `Chunk 5: 50,000 rows | Accuracy: …`; then the final accuracy, number of drift events and time | "Test-then-train: every flow is scored *before* the model learns from it, so there's no train/test split; the stream itself is the test. **Important:** this file is in randomly shuffled order (`preprocess.py` splits randomly), so accuracy lands near our *shuffled* result (about 0.56 on the full stream), not the 0.9997 of capture order. In capture order the label barely changes, so 'repeat the last label' scores 0.99997. That was Finding 3." |
| 20–21 | **4. Accuracy over time** | Plots running accuracy against flows processed, with red ✕ marks at drift events | A curve that rises and then flattens, with a few ✕ marks | "On a shuffled stream there are few drift events and no clear pattern. In capture order, almost every alarm sits on a file boundary (42 of 43, p < 0.0005). The detector finds where the dataset was stitched together, not real drift." |
| 22–23 | **5. Evaluation** | Overall accuracy, per-class report and confusion matrix of the prequential predictions | Floods are high and scans low, the same picture as the static models | "Online or offline, the scan ceiling is the same. It's in the data, not the model." |
| 24–25 | **6. Drift events log** | A table of each event's flow position and accuracy at that moment | A handful of rows | "With capture order, this table lines up with the file boundaries; the dashboard's *Drift timeline* shows it." |
| 26–27 | 7. Save | Pickles the pipeline to `saved_models/arf_adwin.pkl` and writes predictions and drift events to `predictions/` | Paths printed | "The API skips this file on purpose: an online model is served differently." |
| 28 | Canonical numbers | Same pointer as the static notebooks | — | The full-stream drift runs are in `evaluation_results/leakfree/arf_full_*_drift_events_multiclass.json`. |

---

## Small inaccuracies in the notebooks

Each one is harmless, but know it before a professor spots it.

| Where | What it says | Correct value |
|---|---|---|
| Leakage-guard comment (all five) | One timestamp alone "scores 1.0000" | The paper's 3-fold cross-validated figure is **0.9976**. Quote that one. |
| Titles | "82 benign flows" | The paper reports **81**. Quote the paper's figure, or just say "about 80". |
| RF and DT tuning cells | Grid search picks the hyperparameters | The paper uses **fixed** settings (RF: 100 trees, depth 15; DT: depth 20) across 3 seeds. The grid is exploration. |
| ARF box plots | Titled "(Scaled Data)" | The data is unscaled in this notebook. |

## Suggested order for the demo

1. **Random Forest:** explain Part 1 fully here (load → leakage guard → class imbalance → tuning → macro-F1 vs accuracy → feature importance).
2. **Decision Tree:** cell 1 only (the `src_port` memorisation story), then compare results.
3. **Logistic Regression / SVM:** class weights, out-of-core SGD and the false alarms. The linear models are the control group.
4. **ARF + ADWIN:** the prequential loop and drift. End with "drift alarms sit on file boundaries".
