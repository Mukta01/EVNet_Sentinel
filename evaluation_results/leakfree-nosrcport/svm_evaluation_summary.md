# Evaluation Summary: svm

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.3364  _(headline metric)_
- **Weighted F1-Score**: 0.8268
- **Accuracy**: 0.8357
- **Precision** (macro): 0.4412
- **Recall** (macro): 0.4355

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.52      0.00      0.01      4172
                   Benign       0.00      0.00      0.00        12
               ICMP_Flood       0.00      1.00      0.00         5
       ICMP_Fragmentation       0.00      0.00      0.00         4
        OS_Fingerprinting       0.15      0.00      0.01      4155
             PSHACK_Flood       1.00      0.99      0.99     29393
                SYN_Flood       1.00      0.96      0.98     38922
         SYN_Stealth_Scan       0.00      0.00      0.00      5215
Service_Version_Detection       0.41      0.02      0.04      4551
           Slowloris_Scan       0.16      0.41      0.23       408
       SynonymousIP_Flood       0.98      1.00      0.99     38511
                TCP_Flood       1.00      1.00      1.00     38445
            TCP_Port_Scan       0.19      0.11      0.14      5269
                UDP_Flood       1.00      0.20      0.33      4811
       Vulnerability_Scan       0.20      0.84      0.32      5850

                 accuracy                           0.84    179723
                macro avg       0.44      0.44      0.34    179723
             weighted avg       0.87      0.84      0.83    179723

```
