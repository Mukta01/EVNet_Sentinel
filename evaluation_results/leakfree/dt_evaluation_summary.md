# Evaluation Summary: dt

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.6692  _(headline metric)_
- **Weighted F1-Score**: 0.6837
- **Accuracy**: 0.6769
- **Precision** (macro): 0.6630
- **Recall** (macro): 0.7012

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.34      0.64      0.44     15379
                   Benign       0.93      1.00      0.96        13
               ICMP_Flood       0.17      0.40      0.24         5
       ICMP_Fragmentation       0.00      0.00      0.00         4
        OS_Fingerprinting       0.26      0.61      0.37     21040
             PSHACK_Flood       1.00      1.00      1.00     29498
                SYN_Flood       1.00      1.00      1.00     39329
         SYN_Stealth_Scan       0.68      0.44      0.54     79633
Service_Version_Detection       0.48      0.48      0.48     43920
           Slowloris_Scan       0.99      1.00      1.00       630
       SynonymousIP_Flood       1.00      1.00      1.00     39328
                TCP_Flood       1.00      1.00      1.00     39329
            TCP_Port_Scan       0.54      0.47      0.50     63999
                UDP_Flood       0.99      1.00      1.00      4870
       Vulnerability_Scan       0.56      0.48      0.52     34705

                 accuracy                           0.68    411682
                macro avg       0.66      0.70      0.67    411682
             weighted avg       0.71      0.68      0.68    411682

```
