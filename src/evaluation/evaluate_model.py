import argparse
import pandas as pd
import numpy as np
import os
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report

def evaluate_predictions(csv_path, output_dir, model_name):
    """
    Evaluates model predictions against ground truth and generates standardized metrics.
    Works for both binary and multiclass classification.
    """
    # Ensure output directory exists
    os.makedirs(output_dir, exist_ok=True)
    
    print(f"Loading predictions from {csv_path}...")
    df = pd.read_csv(csv_path)
    
    if 'y_true' not in df.columns or 'y_pred' not in df.columns:
        raise ValueError("CSV must contain 'y_true' and 'y_pred' columns")
        
    y_true = df['y_true']
    y_pred = df['y_pred']
    
    # Determine if it's binary or multiclass
    unique_labels = sorted(y_true.unique())
    is_binary = len(unique_labels) <= 2
    
    # Use 'macro' for multiclass to treat all classes equally, or 'binary' for binary
    avg_method = 'binary' if is_binary else 'macro'
    
    print(f"Detected {'Binary' if is_binary else 'Multiclass'} Classification.")
    
    # Calculate metrics
    accuracy = accuracy_score(y_true, y_pred)
    precision = precision_score(y_true, y_pred, average=avg_method, zero_division=0)
    recall = recall_score(y_true, y_pred, average=avg_method, zero_division=0)
    f1 = f1_score(y_true, y_pred, average=avg_method, zero_division=0)
    
    # Full report
    report = classification_report(y_true, y_pred, zero_division=0)
    
    # Print to console
    print("\n" + "="*50)
    print(f" Evaluation Results: {model_name}")
    print("="*50)
    print(f"Accuracy : {accuracy:.4f}")
    print(f"Precision: {precision:.4f} ({avg_method})")
    print(f"Recall   : {recall:.4f} ({avg_method})")
    print(f"F1-Score : {f1:.4f} ({avg_method})")
    print("\nClassification Report:\n")
    print(report)
    print("="*50)
    
    # Save to Markdown summary
    summary_path = os.path.join(output_dir, f"{model_name}_evaluation_summary.md")
    with open(summary_path, 'w') as f:
        f.write(f"# Evaluation Summary: {model_name}\n\n")
        f.write(f"**Classification Type**: {'Binary' if is_binary else 'Multiclass'}\n\n")
        f.write("## Overall Metrics\n")
        f.write(f"- **Accuracy**: {accuracy:.4f}\n")
        f.write(f"- **Precision** ({avg_method}): {precision:.4f}\n")
        f.write(f"- **Recall** ({avg_method}): {recall:.4f}\n")
        f.write(f"- **F1-Score** ({avg_method}): {f1:.4f}\n\n")
        f.write("## Detailed Classification Report\n")
        f.write("```text\n")
        f.write(report)
        f.write("\n```\n")
        
    print(f"\n[+] Saved documented summary to {summary_path}")
    
    # Generate Confusion Matrix Plot
    cm = confusion_matrix(y_true, y_pred)
    
    # Adjust figure size dynamically based on number of classes
    fig_size = max(8, len(unique_labels) * 0.8)
    plt.figure(figsize=(fig_size, fig_size * 0.8))
    
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', 
                xticklabels=unique_labels, yticklabels=unique_labels)
    plt.title(f'Confusion Matrix: {model_name}')
    plt.ylabel('True Label')
    plt.xlabel('Predicted Label')
    plt.tight_layout()
    
    cm_plot_path = os.path.join(output_dir, f"{model_name}_confusion_matrix.png")
    plt.savefig(cm_plot_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"[+] Saved confusion matrix plot to {cm_plot_path}")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Unified Evaluation Script for EVNet Sentinel")
    parser.add_argument("--input", type=str, required=True, help="Path to the prediction CSV file")
    parser.add_argument("--output_dir", type=str, default="evaluation_results", help="Directory to save the evaluation results")
    parser.add_argument("--model_name", type=str, default="Model", help="Name of the model being evaluated")
    
    args = parser.parse_args()
    
    evaluate_predictions(args.input, args.output_dir, args.model_name)
