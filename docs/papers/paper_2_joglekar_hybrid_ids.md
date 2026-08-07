# Paper 2: A Hybrid Intrusion Detection System for Electric Vehicle Charging Infrastructure

> **File**: `2606.23236v1_CJoglekar.pdf`  
> **Authors**: Charukeshi Joglekar, Chijioke Eze, Danni Xiang, Antonello Monti  
> **Affiliations**: Fraunhofer Institute for Applied Information Technology & RWTH Aachen University, Germany  
> **Published**: arXiv:2606.23236v1, June 2026 (submitted to IEEE)  
> **Type**: Research Paper — Novel Hybrid IDS Architecture  
> **Funding**: EU HORIZON Innovation Actions (CyberNEMO project, Grant No. 101168182)  

---

## 1. Paper Overview

This paper proposes a **Hybrid Intrusion Detection System (IDS)** for Electric Vehicle Charging Stations (EVCSs) that combines **Network-based IDS (NIDS)** and **Host-based IDS (HIDS)** into a unified dual-layer detection framework. Unlike existing single-source approaches, this system monitors both network traffic (cyber layer) and host-level activities including power consumption (physical layer). It is validated on the **CICEVSE2024 dataset** and performs multiclass classification across DoS, Recon, FDIA, Backdoor, and Cryptojacking attacks.

---

## 2. Relevance to EVNet Sentinel

This paper is **highly relevant** to EVNet Sentinel for several reasons:

- It uses the **same CICEVSE2024 dataset** that our project uses.
- It provides a **comprehensive data processing pipeline** for network flow, packet-level, host events, and power consumption data — all of which inform our own preprocessing decisions.
- It benchmarks multiple ML classifiers (**RF, XGBoost, LGBM, DT, SVM**) — overlapping with models we evaluate.
- Its **hybrid NIDS + HIDS architecture** represents a natural future extension of EVNet Sentinel's current network-only IDS.
- The paper's NIDS component achieves **99.99% accuracy** with XGBoost on flow-level data, providing a direct comparison point for our ARF-based approach.

---

## 3. EVCS Ecosystem Model (Fig. 1 in paper)

The paper defines the EVCS ecosystem components:

| Component | Description |
|---|---|
| **Electric Vehicles (EVs)** | End-user vehicles that charge at EVCSs |
| **EVCSs** | Charging stations delivering power to EVs |
| **CSMS** | Charging Station Management System — manages operations of all connected EVCSs |
| **Applications/Web Interfaces** | Allow users to locate, reserve, and pay for charging |
| **Power Grid** | Supplies electricity to the entire system |

**Key Actors**:
- **Charging Point Operators (CPOs)**: Own and operate charging stations.
- **EV Drivers**: Use the charging services.
- **DSOs (Distribution System Operators)**: Coordinate with the ecosystem for grid reliability.

**Protocols**:
- **OCPP**: CSMS ↔ EVCS communication.
- **ISO 15118**: EVCS ↔ EV communication (V2G).

---

## 4. Attack Taxonomy (Section II-A)

The paper categorizes EVCS threats into three domains (citing Sharma et al.):

| Domain | Attack Types | Impact |
|---|---|---|
| **Grid-side attacks** | Oscillatory load attacks, power manipulation | Power grid instability |
| **Communication-side attacks** | OCPP exploitation, MitM, DoS, FDIAs | Data tampering, service disruption |
| **User-side attacks** | Targeting access points and user interfaces | Financial losses, compromised availability |

Specific protocol vulnerabilities identified:
- **ISO 15118**: DoS (flooding), Jamming attacks between EVCS and EV.
- **OCPP**: False Data Injection Attacks (manipulating voltage/current/power data), Man-in-the-Middle attacks intercepting CPO-EVCS communication.

> **EVNet Sentinel Relevance**: Our IDS currently focuses on the communication-side (network layer) attack detection. This paper's taxonomy helps us understand the broader threat landscape for potential future extensions.

---

## 5. Gap Analysis of Existing IDS Approaches

### 5.1 Network-based IDS (NIDS) — Limitations Identified

| Study | Dataset | Limitation |
|---|---|---|
| ElKashlan et al. | IoT-23 | General IoT dataset, not EVCS-specific |
| Basnet & Ali | CICIDS2017 | Not specific to EVCS environments |
| Li et al. | CICEVSE2024 | No real-world deployment validation |
| Benfarhat et al. | CICEVSE2024 | Lacks cross-dataset generalization, explainability, continuous learning |
| Jiang et al. | CICEVSE2024 | Only network traffic; ignores host-based attacks |

### 5.2 Host-based IDS (HIDS) — Limitations Identified

| Study | Dataset | Limitation |
|---|---|---|
| Cumplido et al. | ACN, ElaadNL | Only benign data; can it distinguish different HIDS attacks? |
| Girdhar et al. | Simulated | Only benign + simulated attacks, not realistic |
| Sharma et al. | Power data | Centralized AI framework, not a true dual-layer hybrid IDS |

**Key Gap**: No existing work combines NIDS and HIDS into a true dual-layer hybrid system validated on EVCS-specific data.

> **EVNet Sentinel Relevance**: This gap analysis validates our network-based approach as a solid foundation and identifies the hybrid (NIDS + HIDS) architecture as a valuable future direction.

---

## 6. Methodology — Hybrid IDS Architecture

### 6.1 Dataset: CICEVSE2024

The paper uses three data sources from CICEVSE2024:

| Data Source | Records | Features (After Processing) | Focus |
|---|---|---|---|
| **Network Traffic (Flow-level)** | 547,834 | 67 (from original 86 via NFStream) | NIDS |
| **Network Traffic (Packet-level)** | 1,309,252 | 28 (from original 38) | NIDS |
| **Host Events** | 12,499 | HPC + kernel events | HIDS |
| **Power Consumption** | 115,298 | Time-series features | HIDS |

### 6.2 Data Processing Pipeline

#### Network Traffic Processing
- **Flow-based**: Used EVSE-A data; eliminated non-numeric features, columns with missing data or zero variance. Excluded IP/MAC/OUI addresses to prevent data leakage. Applied SMOTE for class imbalance (benign = only 0.015% of all flows), though it had limited effect.
- **Packet-based**: Multi-stage pipeline — extraction, feature derivation, dimensionality optimization. 28 features including TCP flags and payload characteristics. Developed FDIA simulation via pattern-based manipulation.

#### Host Events Processing
- Combined HPC data (cache misses, branch predictions) with kernel-level system events (system calls, I/O operations).

#### Power Consumption Processing
- Specialized time-series processing: cubic spline interpolation for missing values, rolling window feature engineering, StandardScaler normalization.

### 6.3 ML Classifiers Evaluated

| Classifier | Full Name |
|---|---|
| **RF** | Random Forest |
| **LGBM** | Light Gradient Boosting Machine |
| **XGB** | XGBoost |
| **DT** | Decision Tree |
| **SVM** | Support Vector Machine |

- **Train/Val/Test split**: 80/10/10 for network data; 60/20/20 for host/power data.
- **Hyperparameter Optimization**: Bayesian optimization with tree-structured Parzen estimators.
- **Evaluation Metrics**: Accuracy, Precision, Recall, F1-score, G-mean (macro-averaged for multiclass).

> **EVNet Sentinel Relevance**: Our project uses RF, SVM, LR, and DT. This paper's use of XGBoost and LGBM provides benchmarks for potential model additions. Their data leakage prevention (removing IP/MAC) is a practice we should verify in our own pipeline.

---

## 7. Results

### 7.1 NIDS Performance (Network-based Detection)

**Best Model: XGBoost on flow-level data**

| Metric | Score |
|---|---|
| **Accuracy** | 99.99% |
| **Precision** | 99.98% |
| **Recall** | 99.96% |
| **F1-score** | 99.97% |
| **G-mean** | 99.98% |
| **Prediction Time** | 0.706 µs per sample |

- Only **5 misclassifications out of 54,784** test samples.
- All misclassifications were between attack types (never misclassifying attack as benign or vice versa).

### 7.2 HIDS Performance (Host-based Detection)

**Host Events — Best Model: XGBoost**

| Metric | Score |
|---|---|
| Accuracy | 96.60% |
| Precision | 85.25% |
| Recall | 85.58% |
| F1-score | 85.31% |
| G-mean | 92.41% |

**Power Consumption — Best Model: LGBM**

| Metric | Score |
|---|---|
| Accuracy | 70.34% |
| Precision | 73.78% |
| Recall | 71.40% |
| F1-score | 70.57% |

Notable per-attack performance:
- FDIA: F1 = 0.96
- Cryptojacking: F1 = 0.97
- Backdoor: F1 = 0.96

### 7.3 Combined Hybrid IDS Performance

| Metric | Score |
|---|---|
| Accuracy | 83.47% |
| Precision | 82.18% |
| Recall | 82.00% |
| F1-score | 81.47% |
| G-mean | 87.48% |

### 7.4 Comparative Analysis (Table II from paper)

| Approach | Accuracy | Precision | Recall | F1 | Dataset | Type |
|---|---|---|---|---|---|---|
| ElKashlan et al. | 99.20% | 98.50% | 99.00% | 98.70% | IoT23 | NIDS |
| Basnet et al. | 99.95% | 100% | 99.80% | 99.80% | CICIDS2017 | NIDS |
| Li et al. | 97.82% | 98.40% | 97.60% | 98.00% | CICEVSE2024 | NIDS |
| Benfarhat et al. | 93.90% | 94.10% | 93.30% | 93.90% | CICEVSE2024 | NIDS |
| **Proposed NIDS** | **99.99%** | **99.98%** | **99.96%** | **99.97%** | **CICEVSE2024** | **NIDS** |
| Cumplido et al. | 95.30% | — | — | — | ACN, ElaadNL | HIDS |
| Girdhar et al. | 96.80% | — | 99.98% | — | Simulated | HIDS |
| **Proposed HIDS** | **83.47%** | **82.18%** | **82.00%** | **81.47%** | **CICEVSE2024** | **HIDS** |

> **EVNet Sentinel Relevance**: Our ARF + ADWIN achieves 99.13% binary accuracy on the same dataset. This paper's XGBoost achieves 99.99% on multiclass flow-level classification. This is the highest reported accuracy on CICEVSE2024 network data and represents a potential alternative model for our pipeline.

---

## 8. Key Takeaways for EVNet Sentinel

1. **XGBoost is a top contender**: Achieving 99.99% NIDS accuracy on CICEVSE2024, XGBoost should be considered as a model candidate alongside our ARF + ADWIN approach.
2. **Data leakage prevention matters**: The paper explicitly removes IP/MAC/OUI addresses to prevent leakage — a practice we must verify in our own preprocessing.
3. **Flow-level > Packet-level**: Flow-level analysis consistently outperformed packet-level analysis with lower prediction times, validating our focus on flow features.
4. **Hybrid IDS is the future**: The dual-layer approach (NIDS + HIDS) provides more comprehensive coverage. This is a natural extension for EVNet Sentinel beyond our current network-only IDS.
5. **Host-based detection is hard**: Power consumption data achieves only ~70% accuracy, highlighting the difficulty of physical-layer anomaly detection and the importance of our network-first approach.
6. **Class imbalance is a real challenge**: Benign traffic is only 0.015% of flows in CICEVSE2024. SMOTE had limited effect — this aligns with challenges we may face in production.

---

## 9. Future Work Directions (from the paper)

1. **Real-time optimization**: Enhancing feature extraction and classification processes for real-time deployment.
2. **Cross-source correlation**: Improving detection by correlating network and host data sources.
3. **Automated response mechanisms**: Integrating immediate mitigation of detected attacks.
4. **Additional data sources**: Incorporating EV charging behavior data for detecting sophisticated attacks.

---

## 10. Citation

```bibtex
@article{joglekar2026hybrid,
  title={A Hybrid Intrusion Detection System for Electric Vehicle Charging Infrastructure},
  author={Joglekar, Charukeshi and Eze, Chijioke and Xiang, Danni and Monti, Antonello},
  journal={arXiv preprint arXiv:2606.23236},
  year={2026},
  note={Submitted to IEEE}
}
```
