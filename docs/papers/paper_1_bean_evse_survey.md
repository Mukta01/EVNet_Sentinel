# Paper 1: Cybersecurity of Electric Vehicle Charging Infrastructure — Recent Advances, Open Challenges, and Future Directions

> **File**: `2605.24190v1_JBean.pdf`  
> **Authors**: J. Bean, V. Manias (et al.)  
> **Published**: arXiv:2605.24190v1, May 2026  
> **Type**: Survey / Review Paper  

---

## 1. Paper Overview

This is a **comprehensive survey paper** that synthesizes the current state of ML/AI-based intrusion detection and anomaly detection for Electric Vehicle Supply Equipment (EVSE) cybersecurity. It reviews datasets, modeling techniques, and detection strategies, and critically analyzes gaps and future directions in the field.

---

## 2. Relevance to EVNet Sentinel

This paper is a **foundational reference** for EVNet Sentinel. It provides:
- A complete taxonomy of the IDS lifecycle that directly mirrors our project's pipeline (data capture → labeling → ML modeling → deployment → forensics).
- A critical review of the CICEVSE2024 dataset, which is the primary dataset we use.
- A comparative analysis of ML models used across the field, validating our choice of models (Random Forest, SVM, online adaptive models).
- Identification of open challenges that EVNet Sentinel can address (e.g., anomaly detection, scalability, concept drift).

---

## 3. Key Concepts and Definitions

### 3.1 EVSE System Model
The paper defines a high-level EVSE ecosystem comprising:
- **EVCS** (Electric Vehicle Charging Station): Handles network communication/control and power delivery hardware.
- **CSMS** (Charging Station Management System): Cloud management platform for user sessions, power flow, and pricing.
- **Power Grid**: The upstream electrical infrastructure.
- **Vehicular Clients**: The EVs themselves.

Communication is enabled by:
- **OCPP** (Open Charge Point Protocol): Foundation of CSMS ↔ EVCS communication; runs over WebSockets exchanging JSON.
- **ISO 15118**: Standard for vehicle-to-grid communication.

### 3.2 IDS Lifecycle (Fig. 1 in paper)
The paper formalizes the IDS lifecycle as:
1. **Network Traffic Capture** — Packet capture on interfaces.
2. **Data Labeling** — Classifying traffic as benign or malicious.
3. **ML/AI Modeling** — Training models for detection.
4. **Deployment** — Real-time inference on live traffic.
5. **Forensics** — Post-incident auditing and iterative learning.

> **EVNet Sentinel Alignment**: Our project follows this lifecycle directly. Our backend pipeline ingests data, our ML models classify traffic, our WebSocket dashboard delivers real-time alerts, and our architecture supports iterative model updates.

---

## 4. EVSE Attack Surface

The paper identifies the following attack vectors relevant to EVSE:

| Attack Type | Description | Impact |
|---|---|---|
| **Man-in-the-Middle (MitM)** | Intercepting OCPP/ISO15118 communications | Price manipulation, data theft |
| **Denial of Service (DoS)** | Flooding EVCS network interfaces | Service disruption |
| **Reconnaissance** | Scanning and probing network topology | Precursor to targeted attacks |
| **Cryptojacking** | Hijacking EVCS compute resources for mining | Resource degradation |
| **Backdoor** | Persistent unauthorized access to EVCS | Full system compromise |
| **Load-Shifting / Oscillatory Attacks** | Manipulating charging loads via compromised EVCSs | Power grid destabilization |
| **OCPP Data Injection** | Injecting malicious OCPP messages | Session hijacking, billing fraud |

### OCPP Version Security Comparison (Table I from paper)

| Feature | OCPP 1.6 | OCPP 2.0.1 | OCPP 2.1 |
|---|---|---|---|
| **TLS** | Supported but not enforced | Requires TLS v1.2 | Requires TLS v1.2 |
| **Authentication** | RFID only | RFID, credit card, PIN | Adds authorization cache |
| **Message Format** | JSON and SOAP | JSON via WebSockets | JSON via WebSockets |
| **ISO15118 Support** | No | Yes | Yes |

> **EVNet Sentinel Relevance**: Our IDS targets the CICEVSE2024 attack vectors (DoS, Recon, Cryptojacking, Backdoor), which are a subset of the attacks catalogued in this survey.

---

## 5. Detection Strategies and Literature Review

### 5.1 Network Monitoring (Primary approach for EVNet Sentinel)

The paper surveys multiple ML approaches on the CICEVSE2024 dataset:

| Study | Year | Best Model | Accuracy | Monitoring Type |
|---|---|---|---|---|
| Buedi et al. (dataset paper) | 2024 | RF, KNN, SVM | Baseline | Network + Hardware/Power |
| Purohit & Govindarasu | 2024 | DNN (Federated) | ~97% | Network |
| Masum et al. | 2024 | Random Forest | 93.4% | Hardware/Power |
| Thapa et al. | 2025 | LSTM | 99.8% | Network + Hardware/Power |
| Tanyıldız et al. | 2025 | GAN | MAE 0.0281 | Power |
| Almadhor et al. | 2025 | Hybrid LSTM-RNN | <90% | Network + Hardware/Power |
| Kumar et al. | 2025 | XGBoost | 98.6% | Hardware/Power |
| Rahman et al. | 2025 | CNN-LSTM hybrid | ~97% | Network + Hardware/Power |
| **Makhmudov et al.** | **2025** | **Adaptive Random Forest** | **99.13%** | **Network** |
| Li et al. | 2025 | GNN | 97.6% | Hardware/Power |

> **EVNet Sentinel Relevance**: Our project directly reproduces the work of **Makhmudov et al.** (Adaptive Random Forest with ADWIN drift detection), which achieves the best binary detection accuracy (99.13%) on CICEVSE2024 network data. The survey validates ARF as a leading approach and positions our work alongside the state-of-the-art.

### 5.2 Power and Hardware Monitoring

The paper also reviews approaches using the HPC (Hardware Performance Counter) and power consumption portions of CICEVSE2024. These are outside EVNet Sentinel's current scope but represent potential future extensions.

### 5.3 IoT Datasets Used as Proxies

Some studies use general IoT/IDS datasets (IoT-23, CICIDS2017, CICIDS2018) to demonstrate transferability. These achieved nearly 100% accuracy but lack EVSE specificity.

---

## 6. Open Challenges Identified (Section V)

The paper identifies critical gaps that directly inform EVNet Sentinel's roadmap:

### 6.1 Dataset Limitations
- **Small testbeds**: CICEVSE2024 testbeds include only one charger with minimal network architecture, limiting benign data representativeness.
- **No application-layer data**: Network captures are encrypted (TLS), so no OCPP application-layer data is exposed. This limits detection of stealthy data injection attacks.
- **Missing attack vectors**: EVSE-B packet captures contain **no benign data** at all.

### 6.2 Anomaly Detection vs. Classification
- Most existing works perform **binary or multi-class classification**, not true anomaly detection.
- The paper argues for models that learn **baseline normal behavior** and flag deviations, rather than models trained to recognize specific known attack signatures.
- This approach is more robust to **unseen/novel attack patterns**.

### 6.3 Scalability and Concept Drift
- Models must handle evolving network topologies and protocol updates.
- **Concept drift** (changing data distributions over time) is a major concern for deployed IDS models.

> **EVNet Sentinel Alignment**: Our use of **ADWIN (Adaptive Windowing)** for concept drift detection directly addresses Challenge 6.3. The paper explicitly identifies drift-adaptive online learning as a key future direction, which is exactly what our ARF + ADWIN pipeline implements.

---

## 7. Key Takeaways for EVNet Sentinel

1. **CICEVSE2024 is the standard benchmark**: Our dataset choice is validated by the survey as the most widely adopted in the field.
2. **ARF is state-of-the-art for network monitoring**: The survey positions Makhmudov et al.'s Adaptive Random Forest (which we reproduce) as achieving the best performance.
3. **Online learning + drift detection is the future**: The paper explicitly calls for scalable, drift-aware models — our ARF + ADWIN approach is at the frontier.
4. **Anomaly detection is an open challenge**: Future EVNet Sentinel iterations could pivot from classification to true anomaly detection to handle unseen attacks.
5. **Application-layer monitoring is a gap**: Future work could incorporate OCPP message-level analysis (as Odimegwu et al. have started with their OCPP dataset).

---

## 8. Figures and Tables Referenced

- **Fig. 1**: IDS Lifecycle (Traffic Capture → Labeling → ML Modeling → Deployment → Forensics)
- **Fig. 2**: EVSE System Model (EVCS, CSMS, Power Grid, Vehicular Clients)
- **Fig. 3**: Future of EVSE Security (Larger Testbeds → Application Layer Datasets → Anomaly Detection → Scalability/Drift)
- **Table I**: OCPP Version Comparison (1.6 vs 2.0.1 vs 2.1)
- **Table II**: Comprehensive Literature Review of ML Approaches (24 works)

---

## 9. Citation

```bibtex
@article{bean2026cybersecurity,
  title={Cybersecurity of Electric Vehicle Charging Infrastructure: Recent Advances, Open Challenges, and Future Directions},
  author={Bean, J. and Manias, V. and others},
  journal={arXiv preprint arXiv:2605.24190},
  year={2026}
}
```
