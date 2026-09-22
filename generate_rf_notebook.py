import nbformat as nbf

nb = nbf.v4.new_notebook()

nb['cells'] = [
    nbf.v4.new_markdown_cell("# Random Forest - Training & Evaluation\n\nThis notebook trains a generalized Random Forest classifier on the **Balanced** CICEVSE2024 dataset. By constraining the tree depth and using balanced data, we prevent the model from overfitting on majority classes or synthetic duplicates."),
    
    nbf.v4.new_code_cell("""import os
import sys
import joblib
import numpy as np
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns

from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix
from collections import Counter

# Set up beautiful plots
%matplotlib inline
plt.style.use('ggplot')
sns.set_theme(style='whitegrid', palette='deep')
plt.rcParams['figure.figsize'] = (10, 6)
plt.rcParams['figure.dpi'] = 120"""),

    nbf.v4.new_markdown_cell("## 1. Load Balanced Dataset\nWe are loading `X_train_balanced.csv` which has exactly 75,000 samples per class to prevent severe class imbalance bias."),
    
    nbf.v4.new_code_cell("""DATA_DIR = '../../../data/processed'

# Load Training (Balanced)
print("Loading balanced training data...")
X_train = pd.read_csv(os.path.join(DATA_DIR, 'X_train_balanced.csv'))
y_train = pd.read_csv(os.path.join(DATA_DIR, 'y_train_balanced.csv')).values.ravel()

# Load Validation & Test Data (Unbalanced, real-world distribution)
print("Loading validation data...")
X_val = pd.read_csv(os.path.join(DATA_DIR, 'X_val.csv'))
y_val = pd.read_csv(os.path.join(DATA_DIR, 'y_val.csv')).values.ravel()

print("Loading test data...")
X_test = pd.read_csv(os.path.join(DATA_DIR, 'X_test.csv'))
y_test = pd.read_csv(os.path.join(DATA_DIR, 'y_test.csv')).values.ravel()

print(f"X_train shape: {X_train.shape}")
print(f"X_val shape: {X_val.shape}")
print(f"X_test shape: {X_test.shape}")"""),

    nbf.v4.new_markdown_cell("## 2. Visualize Dataset Distribution"),
    
    nbf.v4.new_code_cell("""train_counts = pd.Series(y_train).value_counts()

plt.figure(figsize=(12, 6))
sns.barplot(x=train_counts.values, y=train_counts.index, palette='viridis')
plt.title('Class Distribution in Training Set (Perfectly Balanced)')
plt.xlabel('Number of Samples')
plt.ylabel('Attack Class')
plt.show()"""),

    nbf.v4.new_markdown_cell("## 3. Train Random Forest\nWe constrain the `max_depth` to 25 and `min_samples_leaf` to 5. This forces the trees to learn generalized rules rather than memorizing noise or synthetic duplicates (overfitting)."),

    nbf.v4.new_code_cell("""rf = RandomForestClassifier(
    n_estimators=100,
    max_depth=25,          # Prevents extreme overfitting on specific leaves
    min_samples_leaf=5,    # Requires at least 5 samples per leaf
    random_state=42,
    n_jobs=-1,             # Use all CPU cores for speed
    verbose=1
)

print("Training generalized Random Forest...")
rf.fit(X_train, y_train)
print("Training Complete!")"""),

    nbf.v4.new_markdown_cell("## 4. Evaluation & Visualization"),

    nbf.v4.new_code_cell("""def evaluate_model(model, X, y, dataset_name="Validation"):
    print(f"--- Evaluating on {dataset_name} Set ---")
    preds = model.predict(X)
    
    acc = accuracy_score(y, preds)
    print(f"Accuracy: {acc:.4f}\\n")
    print("Classification Report:")
    print(classification_report(y, preds))
    
    # Plot Confusion Matrix
    cm = confusion_matrix(y, preds, labels=model.classes_)
    plt.figure(figsize=(14, 10))
    sns.heatmap(cm, annot=True, fmt='d', cmap='Blues',
                xticklabels=model.classes_,
                yticklabels=model.classes_)
    plt.title(f'Confusion Matrix ({dataset_name} Set)')
    plt.xlabel('Predicted')
    plt.ylabel('True')
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    plt.show()
    
    return preds"""),
    
    nbf.v4.new_code_cell("""val_preds = evaluate_model(rf, X_val, y_val, "Validation")"""),
    nbf.v4.new_code_cell("""test_preds = evaluate_model(rf, X_test, y_test, "Test")"""),
    
    nbf.v4.new_markdown_cell("## 5. Feature Importances\nLet's visualize which network features the Random Forest found most useful for detecting attacks."),
    
    nbf.v4.new_code_cell("""importances = rf.feature_importances_
indices = np.argsort(importances)[::-1][:20]  # Top 20 features
features = X_train.columns

plt.figure(figsize=(12, 8))
sns.barplot(x=importances[indices], y=[features[i] for i in indices], palette='magma')
plt.title('Top 20 Most Important Features (Random Forest)')
plt.xlabel('Relative Importance')
plt.ylabel('Feature Name')
plt.tight_layout()
plt.show()"""),

    nbf.v4.new_markdown_cell("## 6. Save Model"),
    
    nbf.v4.new_code_cell("""os.makedirs('../../../saved_models', exist_ok=True)
model_path = '../../../saved_models/rf_model_multiclass.pkl'
joblib.dump(rf, model_path)
print(f"Model saved to {model_path}")""")
]

nbf.write(nb, 'src/models/random_forest/Random_Forest_Training.ipynb')
