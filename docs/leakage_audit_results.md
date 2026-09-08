# Leakage Audit — Results

Findings from reproducing Makhmudov et al. (2025), *Mathematics* 13(5):712, on
CICEVSE2024. Tracking issue: #56.

Everything below is reproducible from this repository:

```bash
make replay-reference                      # replays the reference pipeline + audits the leak
make data-process RAW_DIR=... OUT_DIR=...  # corrected pipeline
python3 src/evaluation/build_comparison_table.py
```

---

## Finding 1 — The label is recoverable from a single timestamp column

The reference preprocessing retains six absolute epoch-millisecond columns:
`bidirectional_first_seen_ms`, `bidirectional_last_seen_ms`, `src2dst_first_seen_ms`,
`src2dst_last_seen_ms`, `dst2src_first_seen_ms`, `dst2src_last_seen_ms`.

Each attack in CICEVSE2024 was captured in its own pcap at its own wall-clock
time, so these are a capture-session identifier, not traffic behaviour. None of
the reference notebook's three drop stages removes them (cells 10, 17, 19).

| Measurement | Result |
|---|---|
| `DecisionTree(max_depth=25)` on `bidirectional_first_seen_ms` **alone**, 15-class, 3-fold CV, reference feature set | **0.9976** |
| Same, on our own processed data | **1.0000** |
| Paper's reported multiclass accuracy | 0.9840 |
| Share of feature importance on those 6 columns in our pre-fix Random Forest | **39.8%** |

A one-column decision stump exceeds the published headline number.

Our replay of the reference notebook reaches **1,277,520 rows** against its
reported "~1.2M", so the reconstruction is faithful and the measurement applies
to the published setup.

---

## Finding 2 — Reconnaissance traffic barely exists once its two fingerprints are removed

Reconnaissance flows in CICEVSE2024 are distinguished almost entirely by two
columns: `dst_port` and the capture timestamp. A clean 2×2 ablation, identical
reference feature set throughout, varying only those two:

| Timestamps | `dst_port` | Total rows | Reconnaissance flows | % of max |
|---|---|---|---|---|
| kept | kept | 2,728,799 | 1,724,504 | 100.0% |
| **kept** | **dropped** | **1,277,520** | **273,932** | **15.9%** ← the reference pipeline |
| dropped | kept | 1,198,143 | 194,737 | 11.3% |
| dropped | dropped | 977,862 | **6,821** | **0.4%** |

Flood classes are unaffected throughout (1,001,106 → 970,079, 96.9% retained).

**1,724,504 reconnaissance flows collapse to 6,821 — 0.4% — once both columns
are gone.** This is inherent to the traffic: an nmap port scan is thousands of
structurally identical probes differing only in destination port and the
millisecond they were sent. Remove both and they are one flow.

### The two columns are not equivalent

`dst_port` is a **legitimate** discriminator. A port scan is *defined* by
sweeping destination ports; that is the behaviour, not an artifact.

The capture timestamp is **not**. It identifies which pcap the flow came from.

The reference pipeline drops `dst_port` (cell 19) and keeps the timestamps. It
therefore removes the feature that legitimately identifies reconnaissance and
retains the one that identifies it only by accident of recording time. Its
273,932 reconnaissance flows are separable by *when they were captured*, not by
what they did — which is exactly why a decision stump on
`bidirectional_first_seen_ms` reaches 0.9976 (Finding 1).

Keeping `dst_port` and dropping the timestamps — our `extended` set — gives
194,737 reconnaissance flows distinguished by something real. That is the
defensible configuration and the one our headline numbers use.

> **Correction.** An earlier revision of this document attributed the
> reconnaissance collapse to the timestamps alone. That was wrong: the 2×2 above
> shows each column is independently near-sufficient, and dropping `dst_port`
> accounts for the larger share. The finding stands; the mechanism stated did not.

---

## Finding 3 — The paper's "concept drift events" are capture-file boundaries

**Confirmed at full scale.** ARF+ADWIN run prequentially over the entire
1,921,182-instance stream in capture order, with the paper's exact
hyperparameters, then each drift event's position compared against the points
where the source capture changes (`src/reproduction/drift_boundary_alignment.py`).

| Drift events within N instances of a capture boundary | Count |
|---|---|
| within 100 | **42 / 43 (97.7%)** |
| within 1,000 | 42 / 43 |
| within 20,000 | 42 / 43 |
| median distance | **22 instances** |

Null model, 43 events placed uniformly at random over the stream, 2,000 draws:
**2.2 ± 1.5** would fall within 1,000 instances of a boundary. Observed: 42.
Empirical p < 0.0005.

The detector is firing on the seams between concatenated capture files, not on
evolution in EVCS traffic. CICEVSE2024 is 59 pcaps joined end to end; each join
is an abrupt distribution change by construction.

### Ordering also inflates the accuracy

Same model, same 1.92M instances, only the stream order varies:

| Order | Accuracy | Weighted-F1 | Drift events | Wall clock |
|---|---|---|---|---|
| `file` (capture order) | **0.9997** | 0.9997 | 43 | 25.5 min |
| `shuffled` (paper default) | **0.5585** | 0.5129 | 14 | 255.3 min |

In capture order consecutive instances share a label, so a prequential learner
scores near-perfectly by predicting "the same as recently" — label
autocorrelation, a mechanism entirely separate from the timestamp leak of #46.
A controlled 25,000-instance comparison holding the class distribution fixed
(`--stream-order file-then-shuffle`) gives 0.9976 against 0.5508, confirming the
gap is ordering rather than task difficulty.

The shuffled run's **14** drift events is close to the paper's reported 11 for
multiclass, which is consistent with the paper having shuffled its stream — but
its 0.9840 accuracy is not reproducible without the timestamp leak. Our
leak-free shuffled run reaches 0.5585.

Throughput: 0.795 ms/instance in capture order, 7.972 ms/instance shuffled,
against the paper's reported 3.7 ms.

---

## Finding 4 — `src_port` is a residual, weaker fingerprint

Tracked as #58. Ephemeral source ports are allocated near-sequentially by the OS,
so within a capture they occupy a contiguous band — a lower-resolution version of
the timestamp fingerprint.

| Feature | `DecisionTree(max_depth=25)`, 15-class, 3-fold CV |
|---|---|
| `src_port` alone | **0.4028** |
| `dst_port` alone | 0.2917 |

`src_port` ranked 3rd of 61 features in the corrected Random Forest.

### Controlled measurement

Identical rows, identical split, column removed at fit time
(`src/reproduction/srcport_control.py`), so deduplication cannot confound it:

| Model | with `src_port` | without | Delta |
|---|---|---|---|
| RandomForest(depth 15, 100 trees) | 0.5894 | 0.5138 | −0.0756 |
| DecisionTree(depth 20) | 0.6834 | **0.5135** | **−0.1699** |

The deeper model loses more than twice as much, which is the signature of a
memorisable fingerprint rather than a genuine feature: extra depth buys finer
`src_port` bands and nothing else.

It also resolves an anomaly in the first round of corrected results, where an
unrestricted Decision Tree appeared to beat a Random Forest. Once `src_port` is
removed the two converge (0.5138 vs 0.5135) — **the Decision Tree's entire
advantage was `src_port` exploitation.**

`dst_port` is kept: unlike `src_port` it is the behaviour that defines a port
scan (Finding 2). The default `extended` feature set now drops `src_port` and
retains `dst_port`; `extended-both-ports` reproduces the previous behaviour.

---

## Corrected results

Multiclass, 15 classes. **Macro-F1 is the headline**: with `ICMP_Fragmentation` at
28 raw flows and `Benign` at 82, accuracy tracks the flood classes and hides
everything else.

### The three feature sets

`preprocess.py --feature-set` selects between them. All three drop the six
absolute timestamps (#46); they differ in how they treat ports (#51, #58).

| Set | Ports | Features | Rows after dedup |
|---|---|---|---|
| `reference` | none | 35 | 977,862 |
| `extended` *(default)* | `dst_port` only | 60 | 1,198,151 |
| `extended-both-ports` | both | 61 | 2,744,546 |

### Macro-F1

| Model | `extended-both-ports` | `extended` (default) | `reference` |
|---|---|---|---|
| Random Forest | 0.5894 | **0.5488** | 0.7011 |
| Decision Tree | 0.6692 | **0.5264** | 0.6784 |
| Logistic Regression | 0.3308 | **0.3458** | 0.3047 |
| SVM (SGD, hinge) | 0.3084 | **0.3364** | 0.3058 |

> [!WARNING]
> **These three columns are not directly comparable.** Each feature set produces a
> different deduplicated dataset (2.74M / 1.20M / 0.98M rows) and therefore a
> different test set with a different class balance. The `reference` column looks
> strongest, but its reconnaissance classes hold only a few hundred rows each
> (Finding 2), and high F1 on a small clean class is easy. Compare *within* a
> column, not across.

### Accuracy and weighted-F1, for context

| Model | Set | Macro-F1 | Weighted-F1 | Accuracy |
|---|---|---|---|---|
| Random Forest | `extended` | 0.5488 | 0.8658 | 0.8679 |
| Decision Tree | `extended` | 0.5264 | 0.8674 | 0.8673 |
| Logistic Regression | `extended` | 0.3458 | 0.8298 | 0.8346 |
| SVM | `extended` | 0.3364 | 0.8268 | 0.8357 |
| Random Forest | `reference` | 0.7011 | 0.9966 | 0.9962 |
| Decision Tree | `reference` | 0.6784 | 0.9967 | 0.9962 |

The 0.99 accuracy against 0.70 macro-F1 on `reference` is Finding 2 in action:
99.6% of those rows are floods, which every model solves.

### Effect of removing the timestamp leak

Like-for-like, `extended-both-ports`:

| Model | Macro-F1 before | after | Delta |
|---|---|---|---|
| Random Forest | 0.9547 | 0.5894 | **−0.3653** |
| Logistic Regression | 0.4622 | 0.3308 | −0.1314 |
| SVM (SGD, hinge) | 0.2829 | 0.3084 | +0.0255 |

The SVM barely moves because a linear model could never exploit a timestamp axis
the way a tree can. That, not non-linearity, is what the old 0.9994-vs-0.3665 gap
was measuring.

### Per-class shape (Random Forest, `extended-both-ports`)

| Solved (F1 ≈ 1.00) | Collapses (F1 0.18–0.41) |
|---|---|
| PSHACK_Flood, SYN_Flood, SynonymousIP_Flood, TCP_Flood, UDP_Flood, Benign; Slowloris_Scan 0.90 | Service_Version_Detection 0.18, Aggressive_Scan 0.22, OS_Fingerprinting 0.22, TCP_Port_Scan 0.22, Vulnerability_Scan 0.29, SYN_Stealth_Scan 0.41 |

DoS families have genuine behavioural signatures in packet sizes, flags and
inter-arrival times. The six reconnaissance classes are all nmap modes — `-A` is
literally `-sV -O -sC --traceroute`, a superset of two of the others — and at
flow level they emit near-identical probes. **They should be confusable.** This
is a finding, not a failure: it establishes a realistic ceiling for flow-based
EVCS intrusion detection.

---

## Suggested framing

> Reproducing an EVCS intrusion-detection system reveals that reported
> CICEVSE2024 multiclass accuracy is an artifact of capture-session timestamp
> leakage: a single timestamp column recovers the 15-class label at 0.9976. The
> reference preprocessing compounds this by discarding `dst_port`, the one
> feature that legitimately identifies reconnaissance traffic, while retaining
> the timestamp that identifies it only by recording time — so its 273,932
> reconnaissance flows are separable by *when* they were captured rather than by
> what they did. Removing both fingerprints collapses 1.72M reconnaissance flows
> to 6,821. With the leak removed, flow-level features separate DoS families
> near-perfectly (F1 ≈ 1.00) but cannot distinguish nmap reconnaissance modes,
> and prequential accuracy in capture order is inflated a further 44 points by
> label autocorrelation.

## Still open

- #55: pinned versions, multi-seed runs, hardware and runtime table
- Grouped and temporal splits are implemented (#50) but not yet used for headline numbers
