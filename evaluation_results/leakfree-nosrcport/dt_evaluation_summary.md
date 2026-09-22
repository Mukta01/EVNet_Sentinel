# Evaluation Summary: dt

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.5264  _(headline metric)_
- **Weighted F1-Score**: 0.8674
- **Accuracy**: 0.8673
- **Precision** (macro): 0.5112
- **Recall** (macro): 0.6314

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.19      0.22      0.20      4172
                   Benign       0.62      0.83      0.71        12
               ICMP_Flood       0.28      1.00      0.43         5
       ICMP_Fragmentation       0.27      0.75      0.40         4
        OS_Fingerprinting       0.15      0.32      0.21      4155
             PSHACK_Flood       1.00      1.00      1.00     29393
                SYN_Flood       1.00      1.00      1.00     38922
         SYN_Stealth_Scan       0.21      0.17      0.18      5215
Service_Version_Detection       0.26      0.12      0.17      4551
           Slowloris_Scan       0.10      0.73      0.17       408
       SynonymousIP_Flood       1.00      1.00      1.00     38511
                TCP_Flood       1.00      1.00      1.00     38445
            TCP_Port_Scan       0.22      0.16      0.18      5269
                UDP_Flood       1.00      1.00      1.00      4811
       Vulnerability_Scan       0.37      0.17      0.23      5850

                 accuracy                           0.87    179723
                macro avg       0.51      0.63      0.53    179723
             weighted avg       0.87      0.87      0.87    179723

```
