# Evaluation Summary: rf

**Classification Type**: Multiclass

## Overall Metrics
- **Macro F1-Score**: 0.5488  _(headline metric)_
- **Weighted F1-Score**: 0.8658
- **Accuracy**: 0.8679
- **Precision** (macro): 0.5608
- **Recall** (macro): 0.6113

> Macro-F1 leads because the class distribution is extreme: the flood
> classes hold most of the mass while `ICMP_Fragmentation` has 28 raw flows
> and `Benign` has 82. Accuracy tracks the floods and hides the
> reconnaissance classes almost entirely.

## Detailed Classification Report
```text
                           precision    recall  f1-score   support

          Aggressive_Scan       0.19      0.12      0.15      4172
                   Benign       1.00      0.92      0.96        12
               ICMP_Flood       0.62      1.00      0.77         5
       ICMP_Fragmentation       0.17      0.25      0.20         4
        OS_Fingerprinting       0.15      0.41      0.22      4155
             PSHACK_Flood       1.00      1.00      1.00     29393
                SYN_Flood       1.00      1.00      1.00     38922
         SYN_Stealth_Scan       0.23      0.07      0.11      5215
Service_Version_Detection       0.32      0.10      0.16      4551
           Slowloris_Scan       0.11      0.84      0.20       408
       SynonymousIP_Flood       1.00      1.00      1.00     38511
                TCP_Flood       1.00      1.00      1.00     38445
            TCP_Port_Scan       0.22      0.31      0.26      5269
                UDP_Flood       1.00      1.00      1.00      4811
       Vulnerability_Scan       0.39      0.15      0.22      5850

                 accuracy                           0.87    179723
                macro avg       0.56      0.61      0.55    179723
             weighted avg       0.88      0.87      0.87    179723

```
