import pandas as pd
import os
import argparse
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

def evaluate_dt(predictions_dir, evaluation_results_dir):
    """
    Evaluates the Decision Tree predictions against true labels.
    Generates a Markdown summary of the results (Multiclass only)
    with a plotted Confusion Matrix.
    """
    os.makedirs(evaluation_results_dir, exist_ok=True)
    plots_dir = os.path.join(evaluation_results_dir, "plots")
    os.makedirs(plots_dir, exist_ok=True)
    
    multi_preds_path = os.path.join(predictions_dir, "dt_preds_multiclass.csv")
    if not os.path.exists(multi_preds_path):
        print(f"[-] Predictions file not found: {multi_preds_path}")
        return
        
    df_multi = pd.read_csv(multi_preds_path)
    if "y_true" not in df_multi.columns or "y_pred" not in df_multi.columns:
        print("[-] True labels not found in predictions CSV.")
        return
        
    y_true = df_multi["y_true"]
    y_pred = df_multi["y_pred"]
    
    print("[*] Calculating metrics...")
    acc = accuracy_score(y_true, y_pred)
    report_dict = classification_report(y_true, y_pred, zero_division=0, output_dict=True)
    report_text = classification_report(y_true, y_pred, zero_division=0)
    
    print("[*] Plotting confusion matrix...")
    plot_path = os.path.join(plots_dir, "dt_multiclass_confusion_matrix.png")
    cm = confusion_matrix(y_true, y_pred)
    plt.figure(figsize=(12, 10))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Oranges')
    plt.title('Decision Tree Multiclass Confusion Matrix')
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.tight_layout()
    plt.savefig(plot_path)
    plt.close()
    
    print("[*] Writing Markdown summary...")
    markdown_content = f"""# Evaluation Summary: Decision Tree (Multiclass)

**Classification Type**: Multiclass (15 Classes)
**Algorithm**: Decision Tree Classifier

## Overall Metrics
- **Accuracy**: {acc:.4f}
- **Macro F1-Score**: {report_dict['macro avg']['f1-score']:.4f}
- **Weighted F1-Score**: {report_dict['weighted avg']['f1-score']:.4f}

## Detailed Classification Report
```text
{report_text}
```

## Confusion Matrix
![Confusion Matrix](plots/dt_multiclass_confusion_matrix.png)

---

## Technical Context (Decision Tree)
The Decision Tree classifier is a non-linear, interpretable model that uses recursive binary splitting on feature thresholds. Unlike the linear SVM baseline, Decision Trees can capture complex, non-linear decision boundaries in network traffic data. The model also provides built-in feature importance rankings via Gini impurity reduction, which is valuable for understanding which network flow features are most discriminative for attack classification.
"""

    report_path = os.path.join(evaluation_results_dir, "dt_evaluation_summary.md")
    with open(report_path, "w") as f:
        f.write(markdown_content)
        
    print(f"[+] Saved evaluation report to {report_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Decision Tree Predictions")
    parser.add_argument("--predictions_dir", type=str, default="predictions")
    parser.add_argument("--evaluation_results_dir", type=str, default="evaluation_results")
    args = parser.parse_args()
    
    evaluate_dt(args.predictions_dir, args.evaluation_results_dir)
