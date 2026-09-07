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

## Finding 2 — Reconnaissance traffic is almost entirely duplicate rows

This is the consequence that matters most. Removing *only* the six timestamp
columns and changing nothing else, then deduplicating as the reference does:

| Class | With timestamps | Without | Retained |
|---|---|---|---|
| SYN_Flood | 259,513 | 259,484 | 99.99% |
| SynonymousIP_Flood | 256,808 | 256,739 | 99.97% |
| TCP_Flood | 256,354 | 256,297 | 99.98% |
| PSHACK_Flood | 195,956 | 195,952 | 100.00% |
| **SYN_Stealth_Scan** | 77,278 | **474** | **0.61%** |
| **TCP_Port_Scan** | 64,455 | **409** | **0.63%** |
| **Service_Version_Detection** | 46,334 | **1,035** | **2.23%** |
| **Vulnerability_Scan** | 38,023 | **1,796** | **4.72%** |
| **OS_Fingerprinting** | 26,080 | **1,074** | **4.12%** |
| **Aggressive_Scan** | 21,762 | **2,033** | **9.34%** |
| UDP_Flood | 32,475 | 1,607 | 4.95% |
| Slowloris_Scan | 2,340 | 821 | 35.09% |
| Benign | 82 | 81 | 98.78% |
| ICMP_Flood | 32 | 32 | 100.00% |
| ICMP_Fragmentation | 28 | 28 | 100.00% |
| **Total** | **1,277,520** | **977,862** | |

Aggregated:

| Group | With timestamps | Without | Retained |
|---|---|---|---|
| Reconnaissance (6 classes) | 273,932 | **6,821** | **2.49%** |
| Flood (5 classes) | 1,001,106 | 970,079 | 96.90% |
| Flood share of the dataset | 78.4% | **99.2%** | |

**The 273,932 reconnaissance flows in the paper's dataset are 6,821 behaviourally
distinct flows.** The other 97.5% are exact duplicates made unique only by their
millisecond position in the capture. This is inherent to the traffic: an nmap
port scan is thousands of structurally identical probes differing only in
destination port, so once ports and timestamps are gone they are one flow.

The consequence is that the paper's multiclass task is, after its own
preprocessing, 99.2% flood classification — and floods are easy.

---

## Finding 3 — Prequential accuracy is inflated by stream ordering

Independent of the timestamp leak. Identical 25,000-instance slice, identical
class distribution, leak-free features; only the ordering of the stream varies.

| `--stream-order` | Accuracy | Weighted-F1 | Drift events | On a capture boundary |
|---|---|---|---|---|
| `file` (capture order) | **0.9976** | 0.9975 | 3 | 3/3 |
| `file-then-shuffle` (controlled) | **0.5508** | 0.5318 | 1 | 1/1 |
| `shuffled` (whole stream) | 0.5029 | 0.4909 | 1 | 1/1 |

A **44-point** accuracy drop from reordering alone. In capture order consecutive
instances share a label, so a prequential learner scores near-perfectly by
predicting "the same as recently" — classic label autocorrelation. The
`file-then-shuffle` row is the controlled comparison: same instances, same
classes, same proportions, order alone.

Every drift event fired inside a named capture file, consistent with the #53
hypothesis that the paper's 11–12 "concept drift events" are seams between
concatenated captures rather than evolution in EVCS traffic. Confirming this at
full scale is still open.

---

## Finding 4 — `src_port` is a residual, weaker fingerprint

Tracked as #58. Ephemeral source ports are allocated near-sequentially, so within
a capture they occupy a contiguous band.

| Feature | `DecisionTree(max_depth=25)`, 15-class, 3-fold CV |
|---|---|
| `src_port` alone | 0.4028 |
| `dst_port` alone | 0.2917 |

`src_port` ranks 3rd of 61 features in the corrected Random Forest. The reference
drops both ports; our `extended` set keeps them, which is defensible for
`dst_port` and not for `src_port`.

---

## Corrected results

Multiclass, 15 classes. **Macro-F1 is the headline**: with `ICMP_Fragmentation` at
28 raw flows and `Benign` at 82, accuracy tracks the flood classes and hides
everything else.

### `extended` feature set (ports retained, 61 features, 2,744,546 rows)

| Model | Macro-F1 | Weighted-F1 | Accuracy |
|---|---|---|---|
| Decision Tree | 0.6692 | 0.6837 | 0.6769 |
| Random Forest | 0.5894 | 0.5487 | 0.5470 |
| Logistic Regression | 0.3308 | 0.4636 | 0.5125 |
| SVM (SGD, hinge) | 0.3084 | 0.3926 | 0.4606 |

### `reference` feature set (ports dropped, 35 features, 977,862 rows)

| Model | Macro-F1 | Weighted-F1 | Accuracy |
|---|---|---|---|
| Random Forest | 0.7011 | 0.9966 | 0.9962 |
| Decision Tree | 0.6784 | 0.9967 | 0.9962 |
| Logistic Regression | 0.3047 | 0.9855 | 0.9854 |
| SVM (SGD, hinge) | 0.3058 | 0.9861 | 0.9860 |

The 0.99 accuracy against 0.70 macro-F1 on the reference set is Finding 2 in
action: 99.2% of those rows are floods, which every model solves, while the
recon classes have a few hundred rows each.

### Effect of removing the leak (`extended`, like-for-like models)

| Model | Macro-F1 before | after | Delta |
|---|---|---|---|
| Random Forest | 0.9547 | 0.5894 | **−0.3653** |
| Logistic Regression | 0.4622 | 0.3308 | −0.1314 |
| SVM (SGD, hinge) | 0.2829 | 0.3084 | +0.0255 |

The SVM barely moves because a linear model could never exploit a timestamp axis
the way a tree can. That, not non-linearity, is what the old 0.9994-vs-0.3665
gap was measuring.

### Per-class shape (Random Forest, `extended`)

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
> leakage. A single timestamp column recovers the 15-class label at 0.9976.
> Removing it collapses the reconnaissance classes to 2.49% of their apparent
> size, exposing that the benchmark is 99.2% denial-of-service traffic. With the
> leak removed, flow-level features separate DoS families near-perfectly
> (F1 ≈ 1.00) but cannot distinguish nmap reconnaissance modes (F1 0.18–0.41),
> and prequential accuracy in capture order is inflated a further 44 points by
> label autocorrelation.

## Still open

- #53 at full scale: align every ADWIN drift event against capture boundaries over the whole stream
- #58: drop `src_port` and re-measure
- #55: pinned versions, multi-seed runs, hardware and runtime table
- Grouped and temporal splits are implemented (#50) but not yet used for headline numbers
