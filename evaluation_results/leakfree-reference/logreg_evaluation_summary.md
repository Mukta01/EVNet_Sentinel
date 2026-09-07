# Evaluation Summary: logreg

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.3047  _(headline metric)_
- **Weighted F1-Score**: 0.9855
- **Accuracy**: 0.9854
- **Precision** (macro): 0.2972
- **Recall** (macro): 0.4362

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.00      0.00      0.00       305
                   Benign       0.00      0.00      0.00        12
               ICMP_Flood       0.01      1.00      0.02         5
       ICMP_Fragmentation       0.01      0.75      0.01         4
        OS_Fingerprinting       0.00      0.00      0.00       161
             PSHACK_Flood       1.00      1.00      1.00     29393
                SYN_Flood       1.00      0.98      0.99     38923
         SYN_Stealth_Scan       0.00      0.00      0.00        71
Service_Version_Detection       0.28      0.32      0.30       155
           Slowloris_Scan       0.00      0.00      0.00       123
       SynonymousIP_Flood       0.98      1.00      0.99     38511
                TCP_Flood       1.00      1.00      1.00     38445
            TCP_Port_Scan       0.18      0.49      0.26        61
                UDP_Flood       0.00      0.00      0.00       241
       Vulnerability_Scan       0.00      0.00      0.00       270

                 accuracy                           0.99    146680
                macro avg       0.30      0.44      0.30    146680
             weighted avg       0.99      0.99      0.99    146680

```
