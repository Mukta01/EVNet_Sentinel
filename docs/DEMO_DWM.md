# Demo script: Data Warehousing and Mining

A 15-minute walkthrough of EVNet Sentinel framed for a **Data Warehousing and Mining** professor. Present the project as a complete **KDD process**:

> selection → preprocessing → transformation → mining → evaluation → knowledge presentation

Use DWM vocabulary throughout. Commands and timings are the same as in [DEMO_SCRIPT.md](DEMO_SCRIPT.md).

**Setup** (start each in its own terminal tab, 5 minutes before):

```bash
make web
```
```bash
make api
```
```bash
make diagrams
```

Then open the pipeline diagram (http://localhost:8765/ml-pipeline.html) and the dashboard (http://localhost:3100/dashboard).

---

## 1. The problem, as a data-mining task (1 min, Shardul)

> "We mined 2.7 million network-flow records from an EV charging testbed to classify 15 traffic types: 14 attacks and normal traffic. The published model claims 98.4% accuracy. When we audited the data pipeline, we found that most of that score came from a **data-quality problem**, not from mining. This demo walks through the KDD process and shows where it went wrong."

## 2. Data selection and integration (2 min, Mukta)

Show `ml-pipeline.html`. Click **Still → Live**.

| KDD step | In our project |
|---|---|
| **Source data** | CICEVSE2024: 59 CSV capture files (one per attack and charger state), 2,744,700 rows, 86 attributes extracted by NFStream |
| **Integration** | All 59 files are concatenated into one table. The class label is derived from each file's name (a 19-alias map that unifies inconsistent spellings). |
| **Metadata** | We kept the capture file and charger state as metadata, not as features. A further join on MAC addresses tells us **who attacked whom** (`attack_routes.py`). |

**Point to make:** labelling by file name is a *schema-level* decision with consequences. It makes every attribute that identifies the *file* a proxy for the *label*.

## 3. Preprocessing: cleaning, reduction, transformation (3 min, Shardul)

Open `src/data_prep/preprocess.py` or the paper's preprocessing table.

| Preprocessing task | What we did | Rows / columns |
|---|---|---|
| Attribute removal | Dropped identifiers (flow ID, IP, MAC, vendor) and sparse text fields | 2,744,700 × 65 |
| **Leakage removal** | Dropped the 6 absolute timestamps and `src_port` | → 60 features |
| Data reduction | Removed constant columns (`vlan_id`, `tunnel_id`) | |
| **Duplicate elimination** | Global dedup on the reduced attributes | **1,198,151** rows (56% were duplicates) |
| Transformation | z-score normalisation, z = (x − μ) / σ, **fitted on the training set only** | |
| Partitioning | Stratified 70/15/15 train/validation/test | 838,705 / 179,723 / 179,723 |

**Live demo: the data-quality bug.**

```bash
make replay-reference
```

It takes about 20 seconds. A decision tree on **one timestamp column** scores **0.9976**, higher than the paper's full model (0.984).

**Explain in DWM terms:**
- This is **target leakage**: an attribute that is perfectly correlated with the label in this dataset but would carry no such information on live data.
- Each attack was recorded at its own time, so the timestamp encodes *which file*, and therefore *which class*.
- **Order matters for dedup.** If you drop a column *before* deduplicating, more rows collapse into duplicates. The published pipeline dropped `dst_port` (the feature that defines a port scan) and kept the timestamps, so its scans were separable only by recording time. Table VII in the paper shows this.

## 4. Mining: classification on imbalanced data (3 min, Shruti)

| Concept | In our project |
|---|---|
| **Classifiers** | Decision Tree, Random Forest (ensemble of trees: bagging plus random feature subsets), Logistic Regression, linear SVM |
| **Class imbalance** | The 4 largest floods have about 200k rows each; ICMP fragmentation has 28 and benign 81. We use **balanced class weights**, w_k = N / (K × n_k), instead of over- or undersampling. |
| **Scalability** | The linear models train **out-of-core** with SGD `partial_fit` on 100k-row chunks, because the 838k-row training file doesn't fit comfortably in memory for `LinearSVC`. |
| **Stream mining** | Adaptive Random Forest + **ADWIN**, an online learner that reads one record at a time, predicts it, then learns from it (*prequential*, or test-then-train, evaluation) |

**Show:** dashboard → *Findings* → **Model table**. Every model has about **0.86 accuracy** but very different **macro-F1**: RF 0.558, DT 0.557, LR 0.436, SVM 0.411.

> "Accuracy is dominated by the majority classes. Macro-F1 averages F1 over the 15 classes equally, so it exposes failure on the small ones. Same predictions, 0.868 accuracy, 0.558 macro-F1."

## 5. Evaluation and pattern interpretation (3 min, Shruti, then Shardul)

| Technique | What it showed | Where to show it |
|---|---|---|
| **Confusion matrix** | The floods sit on the diagonal. The 6 scan types smear into each other and into Slowloris. | Dashboard → *Confusion explorer* (switch models) |
| **Per-class precision, recall, F1** | Floods have F1 ≥ 0.999; scans 0.10–0.27 | Paper, Table XII |
| **Multiple runs** | Every result is a mean ± std over 3 random seeds, because the rare classes make one split unreliable | Model table |
| **Information gain / mutual information** | For each attribute, the share of class entropy it removes, I(X;Y)/H(Y), measured inside DoS and inside scans. **DoS: 98%; scans: 5%.** | Dashboard → *Feature separability* |
| **Feature importance** | RF Gini importance (in the notebook) vs model-free mutual information | `Random_Forest_Training.ipynb`, cell 23 |

**The key insight.** This is the same entropy measure used to choose splits in ID3 and C4.5:

> "No single attribute carries information that separates the six scan types, so no classifier built on these attributes can separate them, however powerful. The limit is in the data, not the algorithm."

**Concept drift** (dashboard → *Drift timeline*):
- In capture order, the label changes only **54 times in 1.92 million records**. Predicting "the same as the previous record" is right 99.997% of the time, and ARF scores 0.9997, so it doesn't beat that trivial baseline.
- **42 of 43** drift alarms fall on file boundaries (p < 0.0005).
- **Lesson for stream mining:** the record order was an artefact of how the data was stored, and the drift detector found the joins between files, not real change. Always compare against a naive baseline.

## 6. Knowledge presentation: the "warehouse" layer (2 min, Mukta, then Neha)

| DWM idea | In our project |
|---|---|
| **Single source of truth** | `evaluation_results/` holds every result. The exporters (`export_*.py`) are the **ETL step** that loads it into `frontend/data/*.json`. |
| **Data mart / reporting layer** | The dashboard and the paper's figures both read the same JSON, so they **cannot disagree** (see `ml-pipeline.html`) |
| **OLAP-style analysis** | The dashboard lets you **slice** by model, **dice** by attack × model, **drill down** from category (DoS / Recon) to attack type to individual flows (*Live inference*), and **roll up** from attack to category in the confidence gate |
| **Data provenance** | Each folder is labelled current, evidence or historical (`evaluation_results/README.md`), and each figure is regenerated from code (`make figures`) |

**Show:** dashboard → *Attack insights*. Click an attack to drill down; the takeaway cards are the mined *knowledge*:
- No attack is missed.
- Floods are named exactly.
- Scans are recognised as scans 96% of the time but named only 34%.
- Random Forest gives the fewest false alarms: 2%, against 46–59% for the linear models.

**Neha:** a 1-minute tour of the simulation console.
1. Launch a SYN flood.
2. The site goes **Network not safe**, and Sentinel recommends quarantining the attacking device.
3. Approve the quarantine. The site returns to Safe.

This is the knowledge applied as a decision.

## 7. Close (1 min, Shardul)

> "The biggest result came from the **preprocessing stage, not the mining stage**. One leaky attribute made the published model look near-perfect. After cleaning, the mining is honest: floods are solved, scans are limited by the information in the data, and every number traces back to one source of truth."

---

## Likely questions

| Question | Answer |
|---|---|
| Why not SMOTE or oversampling? | Class weights reach the same goal without creating synthetic records. With 28–81 rows in some classes, synthetic samples would mostly copy a handful of real flows. |
| Is this a data warehouse? | Not an enterprise warehouse. We use its principles: one integrated, versioned store of results, an ETL step into a reporting layer, and OLAP-style slicing in the dashboard. |
| Why deduplicate before splitting? | Otherwise an identical record can land in both training and test, and the model scores by memorising it. |
| Why fit the scaler on training data only? | Fitting on all the data leaks test-set statistics into training. |
| Why did your Decision Tree beat Random Forest at first? | It memorised `src_port` bands, because ephemeral ports are allocated almost sequentially in each capture. With `src_port` removed the two converge (0.557 vs 0.558). |
| Did you try association rules or clustering? | No. The task is supervised classification. Clustering the scan flows would be a good follow-up to test whether the six scan types form natural groups at all. The 5% mutual-information figure suggests they won't. |
| Can it handle new data? | The API classifies one record per request (`curl` demo in [DEMO_SCRIPT.md](DEMO_SCRIPT.md), part 4). ARF + ADWIN can keep learning online. |
