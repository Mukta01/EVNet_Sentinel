# Evaluation Summary: svm

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.3084  _(headline metric)_
- **Weighted F1-Score**: 0.3926
- **Accuracy**: 0.4606
- **Precision** (macro): 0.3144
- **Recall** (macro): 0.4213

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.00      0.00      0.00     15379
                   Benign       0.00      0.00      0.00        13
               ICMP_Flood       0.00      1.00      0.00         5
       ICMP_Fragmentation       0.00      0.00      0.00         4
        OS_Fingerprinting       0.10      0.09      0.10     21040
             PSHACK_Flood       1.00      0.99      0.99     29498
                SYN_Flood       1.00      0.97      0.98     39329
         SYN_Stealth_Scan       0.00      0.00      0.00     79633
Service_Version_Detection       0.17      0.94      0.29     43920
           Slowloris_Scan       0.22      0.33      0.26       630
       SynonymousIP_Flood       0.98      1.00      0.99     39328
                TCP_Flood       1.00      1.00      1.00     39329
            TCP_Port_Scan       0.00      0.00      0.00     63999
                UDP_Flood       0.00      0.00      0.00      4870
       Vulnerability_Scan       0.24      0.00      0.00     34705

                 accuracy                           0.46    411682
                macro avg       0.31      0.42      0.31    411682
             weighted avg       0.40      0.46      0.39    411682

```
