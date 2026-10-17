# Boosted trees vs the baseline models

Same splits, features and seeds (42, 1337, 2024) as `evaluation_results/multiseed/`. Mean ± std over seeds.

| Model | Macro-F1 | Weighted F1 | Accuracy | Fit (s) |
|---|---|---|---|---|
| RandomForest | 0.5582 ± 0.0080 | 0.8654 | 0.8679 | 8.5 |
| DecisionTree | 0.5568 ± 0.0095 | 0.8677 | 0.8681 | 3.4 |
| XGBoost *(new)* | 0.5511 ± 0.0110 | 0.8678 | 0.8685 | 33.0 |
| LightGBM *(new)* | 0.5504 ± 0.0035 | 0.8676 | 0.8681 | 42.4 |
| LogisticRegression | 0.4355 ± 0.0172 | 0.8529 | 0.8626 | 78.9 |
| SVM | 0.4110 ± 0.0165 | 0.8489 | 0.8623 | 34.9 |

## Per-class F1 (mean over seeds)

| Class | RandomForest | DecisionTree | XGBoost | LightGBM | LogisticRegression | SVM |
|---|---|---|---|---|---|---|
| Aggressive_Scan | 0.145 | 0.179 | 0.175 | 0.182 | 0.081 | 0.041 |
| Benign | 0.986 | 0.941 | 0.972 | 0.972 | 0.225 | 0.192 |
| ICMP_Flood | 0.660 | 0.638 | 0.516 | 0.505 | 0.216 | 0.178 |
| ICMP_Fragmentation | 0.439 | 0.422 | 0.414 | 0.421 | 0.095 | 0.094 |
| OS_Fingerprinting | 0.223 | 0.227 | 0.234 | 0.229 | 0.039 | 0.022 |
| PSHACK_Flood | 0.9999 | 0.9999 | 0.9999 | 0.9999 | 0.9998 | 0.9998 |
| SYN_Flood | 0.9998 | 0.9998 | 0.9998 | 0.9998 | 0.991 | 0.992 |
| SYN_Stealth_Scan | 0.105 | 0.175 | 0.191 | 0.178 | 0.042 | 0.183 |
| Service_Version_Detection | 0.156 | 0.174 | 0.164 | 0.166 | 0.076 | 0.027 |
| Slowloris_Scan | 0.191 | 0.166 | 0.178 | 0.176 | 0.283 | 0.145 |
| SynonymousIP_Flood | 0.9998 | 0.9998 | 0.9998 | 0.9998 | 0.991 | 0.992 |
| TCP_Flood | 0.9998 | 0.9998 | 0.9998 | 0.9998 | 0.9998 | 0.9998 |
| TCP_Port_Scan | 0.265 | 0.202 | 0.208 | 0.207 | 0.278 | 0.100 |
| UDP_Flood | 0.9994 | 0.9991 | 0.9992 | 0.9992 | 0.9995 | 0.9995 |
| Vulnerability_Scan | 0.204 | 0.230 | 0.217 | 0.219 | 0.215 | 0.201 |
