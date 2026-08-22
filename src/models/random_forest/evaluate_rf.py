import pandas as pd
import os
import joblib
import argparse
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score

def evaluate_rf(predictions_dir, evaluation_results_dir):
    """
    Evaluates the Random Forest predictions against true labels.
    Generates a Markdown summary of the results.
    """
    os.makedirs(evaluation_results_dir, exist_ok=True)
    
    report_lines = ["# Random Forest Evaluation Summary\n"]
    
    # 1. Evaluate Binary Model
    binary_preds_path = os.path.join(predictions_dir, "rf_preds_binary.csv")
    if os.path.exists(binary_preds_path):
        df_binary = pd.read_csv(binary_preds_path)
        if "y_true" in df_binary.columns and "y_pred" in df_binary.columns:
            y_true = df_binary["y_true"]
            y_pred = df_binary["y_pred"]
            
            report_lines.append("## Binary Classification Performance\n")
            acc = accuracy_score(y_true, y_pred)
            report_lines.append(f"**Accuracy:** {acc:.4f}\n")
            
            report_lines.append("### Classification Report\n")
            report_lines.append("```text\n")
            report_lines.append(classification_report(y_true, y_pred, zero_division=0))
            report_lines.append("\n```\n")
            
            report_lines.append("### Confusion Matrix\n")
            report_lines.append("```text\n")
            report_lines.append(str(confusion_matrix(y_true, y_pred)))
            report_lines.append("\n```\n")
        else:
            report_lines.append("## Binary Classification Performance\n")
            report_lines.append("*True labels not found in predictions CSV.*\n")
            
    # 2. Evaluate Multiclass Model
    multi_preds_path = os.path.join(predictions_dir, "rf_preds_multiclass.csv")
    if os.path.exists(multi_preds_path):
        df_multi = pd.read_csv(multi_preds_path)
        if "y_true" in df_multi.columns and "y_pred" in df_multi.columns:
            y_true = df_multi["y_true"]
            y_pred = df_multi["y_pred"]
            
            report_lines.append("## Multiclass Classification Performance\n")
            acc = accuracy_score(y_true, y_pred)
            report_lines.append(f"**Accuracy:** {acc:.4f}\n")
            
            report_lines.append("### Classification Report\n")
            report_lines.append("```text\n")
            report_lines.append(classification_report(y_true, y_pred, zero_division=0))
            report_lines.append("\n```\n")
            
            report_lines.append("### Confusion Matrix\n")
            report_lines.append("```text\n")
            report_lines.append(str(confusion_matrix(y_true, y_pred)))
            report_lines.append("\n```\n")
        else:
            report_lines.append("## Multiclass Classification Performance\n")
            report_lines.append("*True labels not found in predictions CSV.*\n")
            
    # Save report
    report_path = os.path.join(evaluation_results_dir, "rf_evaluation_summary.md")
    with open(report_path, "w") as f:
        f.writelines(report_lines)
        
    print(f"[+] Saved evaluation report to {report_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Evaluate Random Forest Predictions")
    parser.add_argument("--predictions_dir", type=str, default="predictions")
    parser.add_argument("--evaluation_results_dir", type=str, default="evaluation_results")
    args = parser.parse_args()
    
    evaluate_rf(args.predictions_dir, args.evaluation_results_dir)
