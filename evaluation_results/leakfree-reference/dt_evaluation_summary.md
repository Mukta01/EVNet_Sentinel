# Evaluation Summary: dt

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.6784  _(headline metric)_
- **Weighted F1-Score**: 0.9967
- **Accuracy**: 0.9962
- **Precision** (macro): 0.6882
- **Recall** (macro): 0.7084

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.87      0.56      0.68       305
                   Benign       0.92      0.92      0.92        12
               ICMP_Flood       0.29      0.80      0.42         5
       ICMP_Fragmentation       0.20      0.25      0.22         4
        OS_Fingerprinting       0.51      0.48      0.49       161
             PSHACK_Flood       1.00      1.00      1.00     29393
                SYN_Flood       1.00      1.00      1.00     38923
         SYN_Stealth_Scan       0.10      0.21      0.13        71
Service_Version_Detection       0.58      0.52      0.54       155
           Slowloris_Scan       0.93      0.91      0.92       123
       SynonymousIP_Flood       1.00      1.00      1.00     38511
                TCP_Flood       1.00      1.00      1.00     38445
            TCP_Port_Scan       0.12      0.43      0.18        61
                UDP_Flood       0.96      0.98      0.97       241
       Vulnerability_Scan       0.87      0.58      0.69       270

                 accuracy                           1.00    146680
                macro avg       0.69      0.71      0.68    146680
             weighted avg       1.00      1.00      1.00    146680

```
