import pandas as pd
import os
import joblib
import argparse
from sklearn.svm import LinearSVC

def train_and_predict_svm(X_train_path, y_train_path, X_test_path, predictions_dir, model_save_dir):
    """
    Trains and saves dual Support Vector Machine (LinearSVC) models (Binary & Multiclass)
    for EVNet Sentinel Epic 2. Generates corresponding predictions.
    """
    # Create directories if they don't exist
    os.makedirs(model_save_dir, exist_ok=True)
    os.makedirs(predictions_dir, exist_ok=True)
    
    print(f"[*] Loading training data from {X_train_path} and {y_train_path}...")
    
    # 1. Load Data
    X_train = pd.read_csv(X_train_path)
    y_train = pd.read_csv(y_train_path)
    X_test = pd.read_csv(X_test_path)
    
    # Separate the targets
    if "Label_Binary" not in y_train.columns or "Label_Multiclass" not in y_train.columns:
        raise ValueError("y_train must contain 'Label_Binary' and 'Label_Multiclass' columns.")
        
    y_train_binary = y_train["Label_Binary"]
    y_train_multi = y_train["Label_Multiclass"]
    
    print(f"[*] Initializing LinearSVC models...")
    # 2. Train Models
    # Using LinearSVC because SVC(kernel='linear') is too slow for millions of rows.
    # dual=False is preferred when n_samples > n_features.
    model_binary = LinearSVC(dual=False, random_state=42)
    model_multi = LinearSVC(dual=False, random_state=42)
    
    print(f"[*] Training Binary Model...")
    model_binary.fit(X_train, y_train_binary)
    
    print(f"[*] Training Multiclass Model...")
    model_multi.fit(X_train, y_train_multi)
    
    # 3. Save Models
    binary_model_path = os.path.join(model_save_dir, "svm_model_binary.pkl")
    multi_model_path = os.path.join(model_save_dir, "svm_model_multiclass.pkl")
    
    joblib.dump(model_binary, binary_model_path)
    joblib.dump(model_multi, multi_model_path)
    print(f"[+] Saved Binary Model to {binary_model_path}")
    print(f"[+] Saved Multiclass Model to {multi_model_path}")
    
    # 4. Generate Predictions
    print(f"[*] Generating Predictions for X_test...")
    y_pred_binary = model_binary.predict(X_test)
    y_pred_multi = model_multi.predict(X_test)
    
    # Binary Predictions
    preds_binary_df = pd.DataFrame({"Prediction_Binary": y_pred_binary})
    
    # Multiclass Predictions
    preds_multi_df = pd.DataFrame({"Prediction_Multiclass": y_pred_multi})
    
    # Epic 4 Compat: Try to add true labels if y_test exists alongside X_test
    y_test_path = X_test_path.replace('X_test', 'y_test')
    if os.path.exists(y_test_path):
        print(f"[*] Found y_test.csv. Binding true labels for easier evaluation later.")
        y_test = pd.read_csv(y_test_path)
        preds_binary_df["y_true"] = y_test["Label_Binary"]
        preds_binary_df["y_pred"] = y_pred_binary
        
        preds_multi_df["y_true"] = y_test["Label_Multiclass"]
        preds_multi_df["y_pred"] = y_pred_multi
    
    binary_preds_path = os.path.join(predictions_dir, "svm_preds_binary.csv")
    multi_preds_path = os.path.join(predictions_dir, "svm_preds_multiclass.csv")
    
    preds_binary_df.to_csv(binary_preds_path, index=False)
    preds_multi_df.to_csv(multi_preds_path, index=False)
    
    print(f"[+] Saved Binary Predictions to {binary_preds_path}")
    print(f"[+] Saved Multiclass Predictions to {multi_preds_path}")
    print(f"[*] SVM Training and Prediction Pipeline Complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train and Evaluate the Dual SVM Models (Binary & Multiclass)")
    parser.add_argument("--input_X_train", type=str, default="data/processed/X_train.csv", help="Path to X_train.csv")
    parser.add_argument("--input_y_train", type=str, default="data/processed/y_train.csv", help="Path to y_train.csv")
    parser.add_argument("--input_X_test", type=str, default="data/processed/X_test.csv", help="Path to X_test.csv")
    parser.add_argument("--predictions_dir", type=str, default="predictions", help="Directory to save prediction CSVs")
    parser.add_argument("--model_save_dir", type=str, default="saved_models", help="Directory to save the pickled models")
    
    args = parser.parse_args()
    
    train_and_predict_svm(args.input_X_train, args.input_y_train, args.input_X_test, args.predictions_dir, args.model_save_dir)
