# Evaluation Summary: rf

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.7011  _(headline metric)_
- **Weighted F1-Score**: 0.9966
- **Accuracy**: 0.9962
- **Precision** (macro): 0.7552
- **Recall** (macro): 0.7046

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.85      0.49      0.62       305
                   Benign       1.00      0.92      0.96        12
               ICMP_Flood       0.50      0.80      0.62         5
       ICMP_Fragmentation       1.00      0.25      0.40         4
        OS_Fingerprinting       0.47      0.50      0.48       161
             PSHACK_Flood       1.00      1.00      1.00     29393
                SYN_Flood       1.00      1.00      1.00     38923
         SYN_Stealth_Scan       0.06      0.10      0.08        71
Service_Version_Detection       0.58      0.58      0.58       155
           Slowloris_Scan       0.94      0.92      0.93       123
       SynonymousIP_Flood       1.00      1.00      1.00     38511
                TCP_Flood       1.00      1.00      1.00     38445
            TCP_Port_Scan       0.12      0.44      0.19        61
                UDP_Flood       0.96      0.99      0.98       241
       Vulnerability_Scan       0.85      0.58      0.69       270

                 accuracy                           1.00    146680
                macro avg       0.76      0.70      0.70    146680
             weighted avg       1.00      1.00      1.00    146680

```
