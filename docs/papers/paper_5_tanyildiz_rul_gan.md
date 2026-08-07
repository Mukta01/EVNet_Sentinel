# Paper 5: Detection of Cyber Attacks in Electric Vehicle Charging Systems Using a Remaining Useful Life Generative Adversarial Network

> **File**: `s41598-025-92895-9.pdf`  
> **Authors**: Hayriye Tanyildiz, Canan Batur Sahin, Ozlem Batur Dinler, Hazem Migdady, Kashif Saleem, Aseel Smerat, Amir H. Gandomi, Laith Abualigah  
> **Published**: Scientific Reports 2025, 15:10092 (Nature Portfolio)  
> **Type**: Research Paper — Hybrid GAN-Deep Learning Pre-Warning System  
> **DOI**: 10.1038/s41598-025-92895-9  
> **Dataset**: [EVS One Electric Vehicle Dataset (Kaggle)](https://www.kaggle.com/datasets/geoffnel/evs-one-electric-vehicle-dataset)  

---

## 1. Paper Overview

This paper proposes a novel **pre-warning system** for Electric Vehicle Charging Systems (EVCS) that estimates the *time until the next attack* (`Time_To_Next_Flag`) using a hybrid deep learning architecture. It integrates a **Generative Adversarial Network (GAN)** with various sequence-based Deep Learning (DL) models (LSTM, GRU, RNN, CNN, MLP, Dense Layer) to handle time-series attack data. 

The core innovation is using the GAN's generator to synthesize realistic attack samples, balancing the dataset, while the deep learning models predict when an imminent attack will occur based on the augmented time-series data.

---

## 2. Relevance to EVNet Sentinel

While Paper 4 (Makhmudov et al.) provides our core *intrusion detection* (binary/multiclass classification) pipeline using ARF, Paper 5 introduces the concept of **predictive early warning** (regression). 

| Feature | Paper 5 (Tanyildiz) | EVNet Sentinel Applicability |
|---|---|---|
| **Core Concept** | Time-to-attack prediction (pre-warning) | Potential future feature: predictive alerts |
| **Dataset** | EVS One (Kaggle) | Different from our CICEVSE2024 dataset |
| **Architecture** | GAN + Deep Learning (GRU/LSTM) | Contrast to our River streaming ML pipeline |
| **Key Metric** | R², MAE, RMSE (Regression) | Contrasts our Accuracy/F1 (Classification) |
| **Focus** | Reducing false negatives (missed attacks) | High-recall alerting strategy |

> **Integration Insight**: EVNet Sentinel currently focuses on *detecting* attacks as they happen (classification). Paper 5 provides theoretical grounding if we later decide to add a *predictive forecasting* module to our dashboard that warns administrators of imminent threats based on current traffic anomalies.

---

## 3. Threat Landscape Context (Table 1 Summary)

The paper provides an excellent taxonomy of EV/EVSE cyber attack scenarios, which is useful for our documentation and dashboard threat intelligence features:

1. **Vehicle Identity Spoofing**: Falsifying VINs to steal charging services.
2. **Brute Force Attacks**: Breaking into access systems (keyless/app).
3. **V2X Communication Attacks**: Spoofing data causing accidents or grid disruption.
4. **Battery Management System (BMS) Attacks**: Manipulating charging to cause wear or fires.
5. **Supply Chain Attacks**: Compromising hardware/software before deployment.
6. **Charge Point Exploits**: Stealing payment info or denying service.

### Proposed Solutions (Section: Solutions to Cyber Attack Scenarios)
1. End-to-End Encryption (TLS)
2. Multi-Factor Authentication (MFA)
3. **Intrusion Detection and Prevention Systems (IDPS)** *(EVNet Sentinel's domain)*
4. Regular Firmware Updates
5. Network Segmentation
6. Blockchain for Secure Transactions
7. Secure V2G Protocols
8. Redundancy Planning
9. **AI-Based Threat Detection** *(EVNet Sentinel's domain)*
10. Security by Design

---

## 4. Proposed Hybrid GAN-DL Architecture

### Why GANs?
The authors use GANs to solve the **data scarcity and imbalance** problem in cybersecurity datasets. The Generator creates synthetic attack patterns (`G(z)`), and the Discriminator (`D(x)`) tries to distinguish them from real attacks. This augmented data trains the subsequent deep learning predictor.

### Hybrid Models Tested
The GAN output is fed into various architectures to predict the continuous variable `Time_To_Next_Flag`:
1. **GAN-LSTM**: Long Short-Term Memory (captures long-term dependencies via 3 gates).
2. **GAN-GRU**: Gated Recurrent Unit (simpler than LSTM, 2 gates: reset and update).
3. **GAN-RNN**: Standard Recurrent Neural Network.
4. **GAN-CNN**: Convolutional Neural Network (spatial feature extraction over time).
5. **GAN-MLP**: Multi-Layer Perceptron.
6. **GAN-Dense Layer**: Standard fully connected layer.

---

## 5. Experimental Results

The models were evaluated on regression metrics to see how closely they predicted the exact time remaining until an attack.

### Overall Performance Metrics

| Model | R² (Variance Explained) | RMSE | MSE | MAE |
|---|---|---|---|---|
| **GAN-MLP** | **0.7379** (Highest) | 0.0954 | 0.0091 | 0.0284 |
| **GAN-LSTM** | 0.7280 | 0.0950 | 0.0090 | 0.0282 |
| **GAN-GRU** | 0.7302 | 0.0950 | 0.0090 | **0.0281** (Lowest Error) |
| **GAN-CNN** | 0.7350 | **0.0948** (Lowest) | **0.0089** (Lowest) | 0.0283 |
| **GAN-RNN** | 0.7290 | 0.0958 | 0.0092 | 0.0291 |

### False Positives vs. False Negatives (Pre-warning Context)

The paper heavily emphasizes the operational impact of prediction errors:
- **Overestimation (Predicted > Actual)**: Model warns too late (False Negative equivalent). High risk of missed attacks.
- **Underestimation (Predicted < Actual)**: Model warns too early (False Positive equivalent). Causes system instability/fatigue.
- **Accurate (Predicted == 0 when Attack == 0)**: In all models, 20,441 imminent attacks were perfectly detected.

**GAN-GRU specific results:**
- 1,467 overestimations (warning too late)
- 1,382 underestimations (warning early — preferred for safety)
- 20,441 perfectly timed detections.

> **Key Takeaway**: The sequential models (LSTM, GRU) perform best practically because they balance the need for early warning without causing excessive false alarms, despite the MLP having a slightly higher raw R² value.

---

## 6. Limitations and Future Work

The authors identify several limitations relevant to EVNet Sentinel:

1. **Reliance on Historical Data**: GANs help, but models may still miss entirely novel attacks (zero-day).
2. **High Computational Cost**: Training deep learning hybrid models is expensive and *hinders real-time deployment* for large EVSE networks.
3. **False Alerts**: Needs further optimization to prevent alert fatigue.

> **EVNet Sentinel Contrast**: Paper 5's Limitation #2 (computational cost hindering real-time deployment) perfectly validates our choice to use **Paper 4's Adaptive Random Forest (ARF)** online learning approach. ARF is lightweight and instance-based (0.0037s per instance), avoiding the heavy batch-training costs of GAN-Deep Learning hybrids.

---

## 7. Citation

```bibtex
@article{tanyildiz2025detection,
  title={Detection of cyber attacks in electric vehicle charging systems using a remaining useful life generative adversarial network},
  author={Tany{\i}ld{\i}z, Hayriye and {\c{S}}ahin, Canan Batur and Dinler, {\"O}zlem Batur and Migdady, Hazem and Saleem, Kashif and Smerat, Aseel and Gandomi, Amir H and Abualigah, Laith},
  journal={Scientific Reports},
  volume={15},
  number={1},
  pages={10092},
  year={2025},
  publisher={Nature Publishing Group UK London},
  doi={10.1038/s41598-025-92895-9}
}
```
