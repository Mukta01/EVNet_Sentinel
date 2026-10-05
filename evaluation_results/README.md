# evaluation_results/

Every number this project reports is in this folder. It holds four generations of results, from before the audit to the final pipeline. Before quoting a number, check which generation it comes from.

| Status | Meaning |
|---|---|
| **Current** | Final corrected pipeline. Cite these. |
| **Evidence** | Supports one specific finding. Cite it for that finding only. |
| **Historical** | Leaked results from before the audit. Never quote them as results. |

## Current

### `multiseed/`: headline results
Written by `src/evaluation/run_experiments.py`. Pipeline: timestamps and `src_port` removed, global dedup, 60 features, 70/15/15 stratified split, seeds 42, 1337 and 2024.

| File | Contents |
|---|---|
| `MULTISEED_RESULTS.md` | Readable report: macro-F1, accuracy and per-class F1 as mean ± std, plus runtimes |
| `multiseed_raw.json` | Per-seed metrics, per-class F1 and full confusion matrices |

| Model | Macro-F1 (mean ± std) |
|---|---|
| Random Forest | 0.5582 ± 0.0080 |
| Decision Tree | 0.5568 ± 0.0095 |
| Logistic Regression | 0.4355 ± 0.0172 |
| SVM | 0.4110 ± 0.0165 |

The paper's result tables, the dashboard and the website all come from `multiseed_raw.json`, through the exporters in `src/evaluation/export_*.py`.

### `attack_tests.json`: per-attack test harness
Written by `src/evaluation/attack_test_harness.py` (`make attack-test`).
- **Per attack:** every class against every model and each of the 3 trained model sets, in 30 batches of 50 unseen flows. Each batch is scored at three levels: detected, right category, exact attack named.
- **Campaigns:** 90 mixed campaigns (30 per model set) of 4 concurrent attacks.
- **Regression gates:**
  - volumetric attacks named exactly ≥ 0.95
  - any attack detected ≥ 0.95
  - scan placed in the recon category ≥ 0.85

  `passed` is `true` when all gates hold.

The dashboard's *Attack insights* tab (`frontend/data/insights.json`) is built from this file.

## Evidence

### `leakfree/`: leak effect and drift
The first corrected run: timestamps removed, but `src_port` still present, and one seed.

| File | Shows |
|---|---|
| `COMPARISON.md` | Leaked vs corrected macro-F1 (RF 0.9547 → 0.5894), plus the 25,000-flow stream-order test (capture order 0.9976 vs shuffled 0.5029) |
| `arf_full_file_drift_events_multiclass.json` | ARF + ADWIN over 1.92M flows in capture order: accuracy 0.9997, 43 drift alarms with their positions |
| `arf_full_shuffled_drift_events_multiclass.json` | The same run on a shuffled stream: accuracy 0.5585, 14 alarms |
| `*_evaluation_summary.md`, `*_confusion_matrix.png`, `plots/` | Per-model reports for this run |

Do not cite the per-model scores here as final. Decision Tree's 0.669 is inflated by `src_port` memorisation, which `leakfree-nosrcport/` removes.

### `leakfree-nosrcport/`: final pipeline, seed 42 only
Same pipeline as `multiseed/` but a single seed: RF 0.5488, DT 0.5264, LR 0.3458, SVM 0.3364. It shows that removing `src_port` closes the Decision Tree's advantage. `multiseed/` supersedes it.

### `leakfree-reference/`: the published feature set, timestamps removed
The paper's own preprocessing (which drops `dst_port`), with only the six timestamps removed and the reference's dedup.
- **Collapse:** 273,932 reconnaissance flows shrink to 6,821, so the test set is 99.2% floods.
- **Result:** accuracy 0.996, but RF macro-F1 only 0.70.

Use it to show that high accuracy can hide failure on the minority classes.

## Historical (pre-audit, leaked)

| File | Contents |
|---|---|
| `rf_evaluation_summary.md` | Original Random Forest trained with the timestamp leak: accuracy 0.9994, macro-F1 0.9547 |
| `SVM_evaluation_summary.md` | Original SVM, also leaked: accuracy 0.3665 |
| `plots/` | Confusion matrices and class distributions from those runs |

These files are the "before" in the before/after comparison.

## Regenerating

These steps need the raw CICEVSE2024 captures, which are not in git.

```bash
python3 src/evaluation/run_experiments.py --raw-dir <captures> --feature-set extended --seeds 42 1337 2024   # multiseed/
make attack-test                                                                                         # attack_tests.json
make insights && make figures                                                                            # frontend/data/*.json and docs/figures/
```

Pipeline diagram: [`docs/diagrams/ml-pipeline.html`](../docs/diagrams/ml-pipeline.html).
