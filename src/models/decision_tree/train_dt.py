import pandas as pd
import os
import joblib
import argparse
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.tree import DecisionTreeClassifier
from sklearn.utils.class_weight import compute_class_weight
from tqdm import tqdm

def train_and_predict_dt(X_train_path, y_train_path, X_test_path, predictions_dir, model_save_dir, plots_dir):
    """
    Trains and saves Decision Tree model (Multiclass only).
    Uses class_weight='balanced' to handle class imbalance.
    """
    # Create directories if they don't exist
    os.makedirs(model_save_dir, exist_ok=True)
    os.makedirs(predictions_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)
    
    print(f"[*] Loading data...")
    X_train = pd.read_csv(X_train_path)
    y_train_full = pd.read_csv(y_train_path)
    
    if "Label_Multiclass" not in y_train_full.columns:
        raise ValueError("y_train must contain 'Label_Multiclass' column.")
    
    # Visualize class distribution
    classes_multi = np.array(sorted(y_train_full["Label_Multiclass"].unique()))
    print(f"[*] Visualizing multiclass distributions...")
    plt.figure(figsize=(10, 5))
    sns.countplot(y=y_train_full["Label_Multiclass"], order=y_train_full["Label_Multiclass"].value_counts().index)
    plt.title("Multiclass Distribution")
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "dt_training_multi_distribution.png"))
    plt.close()
    
    # Compute class weights
    print(f"[*] Computing class weights for balanced training...")
    weights_m = compute_class_weight('balanced', classes=classes_multi, y=y_train_full["Label_Multiclass"])
    class_weight_multi = dict(zip(classes_multi, weights_m))
    
    # Train Decision Tree
    print(f"[*] Training Decision Tree (Multiclass)...")
    model_multi = DecisionTreeClassifier(
        max_depth=20,
        min_samples_split=10,
        min_samples_leaf=5,
        class_weight=class_weight_multi,
        random_state=42
    )
    
    model_multi.fit(X_train, y_train_full["Label_Multiclass"])
    print(f"[+] Training complete. Tree depth: {model_multi.get_depth()}, Leaves: {model_multi.get_n_leaves()}")
    
    # Save Model
    multi_model_path = os.path.join(model_save_dir, "dt_model_multiclass.pkl")
    joblib.dump(model_multi, multi_model_path)
    print(f"[+] Saved model to {multi_model_path}")
    
    # Feature Importance Plot
    print(f"[*] Plotting feature importances...")
    importances = model_multi.feature_importances_
    feature_names = X_train.columns
    feat_imp_df = pd.DataFrame({
        'Feature': feature_names,
        'Importance': importances
    }).sort_values('Importance', ascending=False).head(20)
    
    plt.figure(figsize=(10, 8))
    plt.barh(feat_imp_df['Feature'][::-1], feat_imp_df['Importance'][::-1])
    plt.title('Top 20 Feature Importances — Decision Tree')
    plt.xlabel('Gini Importance')
    plt.tight_layout()
    plt.savefig(os.path.join(plots_dir, "dt_feature_importance.png"))
    plt.close()
    
    # Generate Predictions
    print(f"[*] Generating Predictions for X_test...")
    X_test = pd.read_csv(X_test_path)
    y_pred_multi = model_multi.predict(X_test)
    
    preds_multi_df = pd.DataFrame({"Prediction_Multiclass": y_pred_multi})
    
    y_test_path = X_test_path.replace('X_test', 'y_test')
    if os.path.exists(y_test_path):
        y_test = pd.read_csv(y_test_path)
        preds_multi_df["y_true"] = y_test["Label_Multiclass"]
        preds_multi_df["y_pred"] = y_pred_multi
        
    preds_multi_df.to_csv(os.path.join(predictions_dir, "dt_preds_multiclass.csv"), index=False)
    
    print(f"[+] Saved predictions to {predictions_dir}")
    print("[*] Decision Tree Training and Prediction Pipeline Complete!")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train and Predict with Decision Tree")
    parser.add_argument("--input_X_train", type=str, default="data/processed/X_train.csv")
    parser.add_argument("--input_y_train", type=str, default="data/processed/y_train.csv")
    parser.add_argument("--input_X_test", type=str, default="data/processed/X_test.csv")
    parser.add_argument("--predictions_dir", type=str, default="predictions")
    parser.add_argument("--model_save_dir", type=str, default="saved_models")
    parser.add_argument("--plots_dir", type=str, default="evaluation_results/plots")
    
    args = parser.parse_args()
    
    train_and_predict_dt(args.input_X_train, args.input_y_train, args.input_X_test, 
                         args.predictions_dir, args.model_save_dir, args.plots_dir)
