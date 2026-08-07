# Paper 4: Online Machine Learning for Intrusion Detection in Electric Vehicle Charging Systems

> **File**: `mathematics-13-00712.pdf`  
> **Authors**: Firdavs Makhmudov, Dusmurod Kilichev, Ulugbek Giyosov, Furkat Akhmedov  
> **Published**: Mathematics 2025, 13, 712 (MDPI)  
> **Type**: Research Paper — Online Learning IDS with Concept Drift Detection  
> **DOI**: 10.3390/math13050712  
> **Code**: [GitHub Repository](https://github.com/TATU-hacker/Intrusion_Detection_on_Electric_Vehicle_Charging_Systems.git)  

---

> [!IMPORTANT]
> **This is the primary paper that EVNet Sentinel reproduces and extends.** Our project's ARF + ADWIN pipeline, dataset choice (CICEVSE2024), and evaluation methodology are directly based on this work.

---

## 1. Paper Overview

This paper introduces the **first application of online (streaming) machine learning** for intrusion detection in Electric Vehicle Charging Systems (EVCS). The key innovation is the use of the **Adaptive Random Forest (ARF)** classifier combined with **ADWIN (ADaptive WINdowing)** concept drift detection, enabling real-time adaptation to evolving attack patterns without retraining. The system is validated on the **CICEVSE2024 dataset** with both binary and multiclass classification tasks, achieving **99.13% binary accuracy** and **98.40% multiclass accuracy**.

---

## 2. Relevance to EVNet Sentinel

This paper is the **foundation of our project**:

| Aspect | Paper 4 (Makhmudov) | EVNet Sentinel |
|---|---|---|
| **Core Algorithm** | ARF + ADWIN | ARF + ADWIN (reproduced) |
| **Dataset** | CICEVSE2024 | CICEVSE2024 (same) |
| **Classification** | Binary + Multiclass | Binary + Multiclass (same) |
| **Framework** | River (Python streaming ML) | River (same) |
| **Preprocessing** | StandardScaler | StandardScaler (same) |
| **Extension Goals** | — | Dashboard, real-time visualization, deployment architecture |

---

## 3. Key Contributions (from the paper)

1. **First application of online learning** for EVCS intrusion detection — shifting from static/offline to dynamic/streaming detection.
2. **Integration of ARF with ADWIN drift detection** — providing robust handling of concept drifts and dynamic attack patterns.
3. **Real-time scalability** — efficient performance for large, complex EVCS networks.
4. **EVCS-specific protocol integration** — incorporating OCPP and ISO 15118 protocols for compatibility with existing EV infrastructure standards.
5. **Practical deployment architecture** — a real-world-oriented design for intrusion detection in EVCS.

---

## 4. Gap Analysis — Why Online Learning?

The paper identifies critical limitations of existing IDS approaches (Table 1 in paper):

| Limitation | Offline ML Approaches | Online ML (This Paper) |
|---|---|---|
| **Concept Drift** | Not addressed or only implicit | Explicit via ADWIN |
| **Real-time Adaptability** | Requires retraining | Continuous learning from stream |
| **Protocol Integration** | None or generic | OCPP, ISO 15118, OCPI |
| **Scalability** | Limited by batch size | Processes instance-by-instance |
| **Dynamic Attacks** | Cannot handle evolving patterns | Adapts via drift detection |

### Why ARF Over Other Online Learners? (Table 2 in paper)

| Method | Drift Handling | Ensemble | Noise Resilience |
|---|---|---|---|
| Hoeffding Tree | No explicit | No | Low |
| SAM-KNN | Implicit (memory) | No | Moderate |
| Leveraging Bagging | Implicit (resampling) | Yes | Moderate |
| **ARF** | **Explicit (ADWIN)** | **Yes (ensemble)** | **High** |

> **EVNet Sentinel Relevance**: This justification is why we chose ARF as our primary classifier. The explicit drift detection via ADWIN is the key differentiator.

---

## 5. System Architecture — 5-Step Pipeline

### Overall Architecture

The system uses a **Network Tap** for passive traffic monitoring at the EVCS. Network traffic (including ISO 15118, OCPP, OCPI data exchanges) is captured, mirrored, preprocessed, and fed into the online IDS.

### Step 1: Data Preparation and Streaming

The dataset `D = {(xᵢ, yᵢ)}` is shuffled and fed into a streaming iterator `S` that provides instances one at a time:

```
(x, y) ~ S
```

- **Binary labels**: y ∈ {0, 1} (normal vs. malicious)
- **Multiclass labels**: y ∈ {0, 1, ..., K-1} (specific attack types)

> **EVNet Sentinel Implementation**: We replicate this exact streaming simulation using River's data streaming utilities.

### Step 2: Preprocessing and Classifier Initialization

**Preprocessing**: StandardScaler normalization (zero mean, unit variance):
```
x' = (x - μ) / σ
```

**ARF Classifier Configuration**:

| Parameter | Value | Description |
|---|---|---|
| **n_models (T)** | 20 | Number of decision trees in ensemble |
| **max_features (f_max)** | 0.5 × d | Feature subset at each node split (50% of total features) |
| **grace_period (g)** | 30 | Update tree structure every 30 instances |
| **Leaf Predictor** | Naïve Bayes | Probabilistic prediction at leaf nodes |

**Prediction**:
- **Binary**: Majority voting among T trees
- **Multiclass**: Probabilistic aggregation — `ŷ = argmax_c Σ Pₜ(c|x')`

> **EVNet Sentinel Implementation**: These exact hyperparameters are used in our pipeline.

### Step 3: Metric Evaluation

Four metrics updated dynamically after every instance:

| Metric | Formula |
|---|---|
| **Accuracy** | (TP + TN) / Total |
| **Precision** | Weighted TP / Predicted Positives |
| **Recall** | Weighted TP / Actual Positives |
| **F1-score** | 2 × (Precision × Recall) / (Precision + Recall) |

All metrics use **weighted averaging** to account for class imbalance.

### Step 4: Drift Detection — ADWIN

**ADWIN Configuration**:

| Parameter | Value | Description |
|---|---|---|
| **δ (significance)** | 0.002 | Controls drift sensitivity |
| **clock** | 32 | How often ADWIN checks for changes |
| **max_buckets** | 5 | Bucket compression for memory optimization |
| **min_window_length** | 5 | Minimum window size |
| **grace_period** | 10 | Prevents premature drift detection |

**Drift Detection Mechanism**:
1. Maintain a dynamic sliding window `W = W₁ ∪ W₂`
2. If `|mean(W₁) - mean(W₂)| > ε` (Hoeffding bound): drift detected
3. Discard older portion `W₁`, adjust window size
4. Update function: `drift_detector.update(y == ŷ)` after each prediction

**Drift Types Handled**:
- **Sudden drift**: Abrupt change in data distribution
- **Gradual drift**: Slow shifts over time
- **Recurring drift**: Periodic changes that reappear

> **EVNet Sentinel Implementation**: We use these exact ADWIN parameters for drift detection.

### Step 5: Online Training, Evaluation, and Drift Handling

For each streaming instance `(x, y)`:
1. **Predict**: `ŷ = model.predict_one(x)`
2. **Learn**: `model.learn_one(x, y)` — incremental update
3. **Evaluate**: `metric.update(y, ŷ)` — real-time metric tracking
4. **Detect Drift**: `drift_detector.update(y == ŷ)`

**Total Processing Time**: `T_total = Σ (t_p + t_m + t_d)` where t_p = prediction/learning, t_m = metric computation, t_d = drift detection.

---

## 6. Experimental Setup

### Dataset: CICEVSE2024

- **Source**: Canadian Institute for Cybersecurity
- **Total Instances**: ~1.2 million (flow-level network traffic)
- **Features**: 86 original features (from NFStream)
- **Attack Types (15 classes)**: Benign, DoS (multiple variants), Reconnaissance (multiple variants), FDIA, Backdoor, Cryptojacking

### Hardware

| Component | Specification |
|---|---|
| **CPU** | Intel Core i7-12700KF |
| **RAM** | 32 GB DDR4 |
| **GPU** | NVIDIA GeForce RTX 3060 (12 GB) |
| **OS** | Ubuntu 22.04 |

### Software Stack

| Library | Purpose |
|---|---|
| **River** | Streaming ML framework (ARF, ADWIN, metrics) |
| **Pandas** | Data manipulation |
| **Scikit-learn** | StandardScaler preprocessing |
| **NumPy** | Numerical operations |
| **Matplotlib** | Visualization |

### Code Availability

The experimental code is publicly available:  
[https://github.com/TATU-hacker/Intrusion_Detection_on_Electric_Vehicle_Charging_Systems](https://github.com/TATU-hacker/Intrusion_Detection_on_Electric_Vehicle_Charging_Systems.git)

> **EVNet Sentinel Implementation**: Our project extends this codebase with a React/Next.js dashboard, enhanced visualization, and deployment architecture.

---

## 7. Results

### 7.1 Binary Classification

| Metric | Score |
|---|---|
| **Accuracy** | 0.9913 (99.13%) |
| **Precision** | 0.9999 (99.99%) |
| **Recall** | 0.9914 (99.14%) |
| **F1-score** | 0.9956 (99.56%) |

**Execution Performance**:

| Metric | Time |
|---|---|
| Total Execution Time | 4706.81 s |
| Drift Detection Time | 3.98 s |
| Metric Update Time | 6.59 s |

**Drift Events Detected**: 12 drift events across 1.2M instances

| Drift # | Instance | Detection Time |
|---|---|---|
| 1 | 18,047 | 15:05:32 |
| 2 | 60,511 | 15:06:42 |
| 3 | 84,063 | 15:07:22 |
| 4 | 145,343 | 15:12:21 |
| 5 | 280,255 | 15:24:32 |
| 6 | 305,983 | 15:26:49 |
| 7 | 362,783 | 15:31:35 |
| 8 | 553,983 | 15:44:19 |
| 9 | 699,103 | 15:52:59 |
| 10 | 885,567 | 16:01:51 |
| 11 | 1,089,663 | 16:11:59 |
| 12 | 1,213,183 | 16:19:27 |

**Key Findings**:
- Mean processing time: **0.0037 s per instance** (median: 0.0030 s)
- Only 3,492 outliers (>0.0192 s) out of 1.2M instances (<0.3%)
- Accuracy remained stable at ~0.99 across all drift events
- Post-drift accuracy changes: +0.000001% to +0.000009% (negligible)

### 7.2 Multiclass Classification (15 classes)

| Metric | Score |
|---|---|
| **Accuracy** | 0.9840 (98.40%) |
| **Precision** | 0.9840 (98.40%) |
| **Recall** | 0.9840 (98.40%) |
| **F1-score** | 0.9831 (98.31%) |

**Execution Performance**:

| Metric | Time |
|---|---|
| Total Execution Time | 4703.63 s |
| Drift Detection Time | 4.56 s |
| Metric Update Time | 4.88 s |

**Drift Events Detected**: 11 drift events

| Drift # | Instance | Detection Time |
|---|---|---|
| 1 | 383 | 11:11:31 |
| 2 | 2,239 | 11:11:58 |
| 3 | 114,591 | 11:28:07 |
| 4 | 156,895 | 11:34:49 |
| 5 | 220,063 | 11:44:03 |
| 6 | 247,487 | 11:48:21 |
| 7 | 300,479 | 11:56:44 |
| 8 | 510,079 | 12:04:08 |
| 9 | 613,439 | 12:07:35 |
| 10 | 897,119 | 12:16:59 |
| 11 | 1,270,815 | 12:29:36 |

**Key Findings**:
- Mean processing time: **0.0037 s per instance** (consistent with binary)
- Drift 1 showed +0.082331% accuracy improvement (effective early adaptation)
- Drift 3 showed -0.000196% accuracy drop (minor challenge adapting)
- Most subsequent drifts: marginal changes (+0.000001% to +0.000033%)

> **EVNet Sentinel Relevance**: These are the **exact baseline numbers** our project must reproduce and compare against. Our dashboard should visualize these drift events and metric trends.

---

## 8. Comparative Analysis with Related Work

### Binary Classification Comparison (Table 8 in paper)

| Study | Dataset | Method | Accuracy | Precision | Recall | F1 | Learning |
|---|---|---|---|---|---|---|---|
| Bozömeroğlu et al. | CICEVSE2024 | RF, XGB, LightGBM | 0.9970 | 0.9970 | 0.9970 | 0.9970 | Offline |
| Purohit et al. | CICEVSE2024 | Federated DNN | 0.9980 | 0.9980 | 0.9980 | 0.9980 | Federated |
| Rahman et al. | CICEVSE2024 | ANN, XGB | 0.9990 | 0.9990 | 0.9990 | 0.9990 | Offline |
| ElKashlan et al. | IoT-23 | RF, DT, SVM | 0.9998 | 0.9960 | 0.9990 | 0.9980 | Offline |
| **Proposed (ARF+ADWIN)** | **CICEVSE2024** | **Online ARF** | **0.9913** | **0.9999** | **0.9914** | **0.9956** | **Online** |

### Multiclass Classification Comparison (Table 9 in paper)

| Study | Dataset | Method | Accuracy | Precision | Recall | F1 | Learning |
|---|---|---|---|---|---|---|---|
| Benfarhat et al. | CICEVSE2024 | TCN | 0.9390 | 0.9410 | 0.9330 | 0.9390 | Offline |
| ElKashlan et al. | IoT-23 | Attribute Selection | 0.9920 | 0.9920 | 0.9920 | 0.9920 | Offline |
| **Proposed (ARF+ADWIN)** | **CICEVSE2024** | **Online ARF** | **0.9840** | **0.9840** | **0.9840** | **0.9831** | **Online** |

**Key Insight**: While offline methods achieve slightly higher raw accuracy (e.g., Rahman et al. at 99.90%), they **cannot adapt to concept drift** or evolving attacks. The online approach trades a small accuracy margin for **real-time adaptability**, which is critical for production deployment.

> **EVNet Sentinel Relevance**: Our project should clearly communicate this trade-off in documentation and presentations — the value proposition is not raw accuracy but **adaptive, real-time detection**.

---

## 9. Limitations Acknowledged by the Paper

1. **Computational overhead**: Real-time drift detection and frequent model updates introduce overhead. Future work explores selective updates triggered only when performance drops below a threshold.
2. **Streaming simulation**: The CICEVSE2024 dataset is processed as a simulated stream, not from a live network tap.
3. **No real-world deployment**: The system is validated in an experimental setting, not deployed on actual EVCS infrastructure.

> **EVNet Sentinel Relevance**: These limitations directly inform our project's extension goals — real-time dashboard, deployment architecture, and practical tooling.

---

## 10. ADWIN Parameters Reference

For direct implementation reference, these are the exact parameters from the paper:

```python
from river.drift import ADWIN
from river.ensemble import AdaptiveRandomForestClassifier
from river.preprocessing import StandardScaler

# StandardScaler
scaler = StandardScaler()

# ARF Classifier
model = AdaptiveRandomForestClassifier(
    n_models=20,                    # 20 decision trees
    max_features=0.5,               # 50% feature subset per split
    grace_period=30,                # Update every 30 instances
    leaf_prediction='nba',          # Naïve Bayes Adaptive at leaves
    drift_detector=ADWIN(delta=0.002),  # ADWIN with δ=0.002
)

# Standalone ADWIN for metric-level drift detection
drift_detector = ADWIN(delta=0.002)
```

---

## 11. Key Takeaways for EVNet Sentinel

1. **Our pipeline must reproduce 99.13% binary / 98.40% multiclass accuracy** as the baseline.
2. **12 binary + 11 multiclass drift events** are expected when processing the full CICEVSE2024 dataset.
3. **Processing speed target**: ~0.0037 s per instance (mean).
4. **The value proposition is adaptability, not raw accuracy** — offline methods score higher but cannot handle concept drift.
5. **The River library** is the correct framework choice for streaming ML.
6. **StandardScaler + ARF(n=20, max_features=0.5, grace=30) + ADWIN(δ=0.002)** is the exact configuration to reproduce.
7. **Dashboard visualization targets**: Metric trends over time, drift event markers, class distribution evolution, processing time distributions.

---

## 12. Citation

```bibtex
@article{makhmudov2025online,
  title={Online Machine Learning for Intrusion Detection in Electric Vehicle Charging Systems},
  author={Makhmudov, Firdavs and Kilichev, Dusmurod and Giyosov, Ulugbek and Akhmedov, Furkat},
  journal={Mathematics},
  volume={13},
  number={5},
  pages={712},
  year={2025},
  publisher={MDPI},
  doi={10.3390/math13050712}
}
```
