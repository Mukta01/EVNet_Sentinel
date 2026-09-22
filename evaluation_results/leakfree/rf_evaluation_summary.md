# Evaluation Summary: rf

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.5894  _(headline metric)_
- **Weighted F1-Score**: 0.5487
- **Accuracy**: 0.5470
- **Precision** (macro): 0.6068
- **Recall** (macro): 0.6193

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.14      0.48      0.22     15379
                   Benign       1.00      1.00      1.00        13
               ICMP_Flood       0.40      0.40      0.40         5
       ICMP_Fragmentation       0.00      0.00      0.00         4
        OS_Fingerprinting       0.14      0.52      0.22     21040
             PSHACK_Flood       1.00      1.00      1.00     29498
                SYN_Flood       1.00      1.00      1.00     39329
         SYN_Stealth_Scan       0.45      0.38      0.41     79633
Service_Version_Detection       0.43      0.11      0.18     43920
           Slowloris_Scan       0.82      1.00      0.90       630
       SynonymousIP_Flood       1.00      1.00      1.00     39328
                TCP_Flood       1.00      1.00      1.00     39329
            TCP_Port_Scan       0.37      0.16      0.22     63999
                UDP_Flood       1.00      1.00      1.00      4870
       Vulnerability_Scan       0.35      0.24      0.29     34705

                 accuracy                           0.55    411682
                macro avg       0.61      0.62      0.59    411682
             weighted avg       0.60      0.55      0.55    411682

```
