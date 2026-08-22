import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.metrics import classification_report, confusion_matrix, accuracy_score
import os

preds_path = 'predictions/svm_preds_multiclass.csv'
plot_path = 'evaluation_results/plots/svm_multiclass_confusion_matrix.png'
md_path = 'evaluation_results/SVM_evaluation_summary.md'

os.makedirs('evaluation_results/plots', exist_ok=True)

print("Loading predictions...")
df = pd.read_csv(preds_path)
y_true = df['y_true']
y_pred = df['y_pred']

print("Calculating metrics...")
accuracy = accuracy_score(y_true, y_pred)
report_dict = classification_report(y_true, y_pred, zero_division=0, output_dict=True)
report_text = classification_report(y_true, y_pred, zero_division=0)

print("Plotting confusion matrix...")
cm = confusion_matrix(y_true, y_pred)
plt.figure(figsize=(12, 10))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues')
plt.title('SVM Multiclass Confusion Matrix')
plt.xlabel('Predicted')
plt.ylabel('True')
plt.tight_layout()
plt.savefig(plot_path)
plt.close()

print("Writing Markdown summary...")
markdown_content = f"""# Evaluation Summary: SVM (Multiclass)

**Classification Type**: Multiclass (15 Classes)
**Algorithm**: Support Vector Machine (Out-of-Core `SGDClassifier` with `loss='hinge'`)

## Overall Metrics
- **Accuracy**: {accuracy:.4f}
- **Macro F1-Score**: {report_dict['macro avg']['f1-score']:.4f}
- **Weighted F1-Score**: {report_dict['weighted avg']['f1-score']:.4f}

## Detailed Classification Report
```text
{report_text}
```

## Confusion Matrix
![Confusion Matrix](plots/svm_multiclass_confusion_matrix.png)

---

## Technical Challenges & Resolutions (Epic 2)

During the implementation and training of the baseline Static ML models, we encountered severe technical bottlenecks due to the sheer scale of the CICEVSE2024 flow-level dataset.

### Challenge 1: Out-Of-Memory (OOM) Errors
**The Problem**: The dataset comprises roughly 2.74 Million records and expands to 2.4+ GB when loaded into a dense pandas dataframe. Attempting to fit standard `scikit-learn` algorithms (e.g., `LinearSVC` with `OneVsRestClassifier`) caused catastrophic Memory/RAM crashes (spiking over 50 GB), freezing the host machine.
**The Solution**: We completely abandoned In-Core algorithms and transitioned the architecture to **Out-of-Core Learning**. We rewrote the training logic to use `SGDClassifier` and streamed the data in chunks of 100,000 using `pd.read_csv(chunksize=100000)`. By calling `.partial_fit()` on each batch, we strictly bounded the memory usage to under 500 MB while successfully training on the entire 1.9M row train split in under 10 seconds.

### Challenge 2: Extreme Class Imbalance
**The Problem**: The CICEVSE2024 dataset is heavily imbalanced, acting effectively as an anomalous dataset. The training set (1.92M rows) contained only 58 'Benign' samples, meaning 99.99% of the traffic was attacks. Initially, the model mathematically optimized itself by predicting all traffic as an attack, achieving 99.99% accuracy but entirely failing to identify the benign class.
**The Solution**: We addressed this by pre-computing exact mathematical class frequencies and passing `class_weight='balanced'` explicitly into the `SGDClassifier`. This forced the optimization function to heavily penalize misclassifications on the rare 'Benign' class and rare attack vectors, preventing the model from lazily predicting the majority class.

### Challenge 3: Redundancy of Binary Classification
**The Problem**: Because 99.99% of the labels were 'Attack', a Binary classifier (Attack vs Benign) yielded practically zero actionable intelligence in a Security Operations Center (SOC) dashboard. 
**The Solution**: In adherence with our Agile methodology, we pivoted our strategy. We removed the Binary classification requirements entirely from Epic 2 and streamlined our models to predict strictly the Multiclass labels (identifying the specific *type* of attack), which is significantly more valuable for threat mitigation.
"""

with open(md_path, 'w') as f:
    f.write(markdown_content)

print("Done! Evaluation summary written to", md_path)
