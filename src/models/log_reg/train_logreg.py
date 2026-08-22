import pandas as pd
import os
import joblib
import argparse
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from sklearn.linear_model import SGDClassifier
from tqdm import tqdm

def train_and_predict_logreg(X_train_path, y_train_path, X_test_path, predictions_dir, model_save_dir, plots_dir):
    """
    Trains and saves Logistic Regression model using Out-of-Core learning (SGDClassifier with chunking)
    to prevent Out-of-Memory (OOM) errors on large datasets (e.g., 2.4+ GB).
    Only trains the Multiclass model.
    """
    # Create directories if they don't exist
    os.makedirs(model_save_dir, exist_ok=True)
    os.makedirs(predictions_dir, exist_ok=True)
    os.makedirs(plots_dir, exist_ok=True)
    
    print(f"[*] Pre-computing unique classes from {y_train_path}...")
    
    # Load just the targets entirely (they are small enough to fit in RAM)
    y_train_full = pd.read_csv(y_train_path)
    
    if "Label_Multiclass" not in y_train_full.columns:
        raise ValueError("y_train must contain a 'Label_Multiclass' column.")
        
    classes_multi = np.array(sorted(y_train_full["Label_Multiclass"].unique()))
    
    from sklearn.utils.class_weight import compute_class_weight
    
    print(f"[*] Computing explicit class weights for balanced training...")
    weights_m = compute_class_weight('balanced', classes=classes_multi, y=y_train_full["Label_Multiclass"])
    class_weight_multi = dict(zip(classes_multi, weights_m))
    
    print(f"[*] Initializing SGDClassifier (Out-of-Core Logistic Regression) model...")
    # Using SGDClassifier with loss='log_loss' replicates Logistic Regression
    # We pass the pre-computed dictionary weights because 'balanced' string is not supported in partial_fit
    model_multi = SGDClassifier(loss='log_loss', random_state=42, class_weight=class_weight_multi)
    
    # Determine the total number of rows for the progress bar
    total_samples = len(y_train_full)
    chunk_size = 100000
    total_chunks = (total_samples // chunk_size) + (1 if total_samples % chunk_size != 0 else 0)
    
    print(f"[*] Training Model in {total_chunks} chunks (Out-of-Core)...")
    
    # We delete the full y_train from memory to be safe, though it's small.
    del y_train_full
    
    X_chunker = pd.read_csv(X_train_path, chunksize=chunk_size)
    y_chunker = pd.read_csv(y_train_path, chunksize=chunk_size)
    
    with tqdm(total=total_samples, desc="Processing Rows") as pbar:
        for X_chunk, y_chunk in zip(X_chunker, y_chunker):
            # Train Multiclass
            model_multi.partial_fit(X_chunk, y_chunk["Label_Multiclass"], classes=classes_multi)
            
            pbar.update(len(X_chunk))
    
    # 3. Save Model
    multi_model_path = os.path.join(model_save_dir, "logreg_model_multiclass.pkl")
    joblib.dump(model_multi, multi_model_path)
    print(f"[+] Saved Multiclass Model to {multi_model_path}")
    
    # 4. Generate Predictions
    print(f"[*] Generating Predictions for X_test...")
    X_test = pd.read_csv(X_test_path)
    y_pred_multi = model_multi.predict(X_test)
    
    # Multiclass Predictions
    preds_multi_df = pd.DataFrame({"Prediction_Multiclass": y_pred_multi})
    
    # Bind true labels if y_test exists alongside X_test
    y_test_path = X_test_path.replace('X_test', 'y_test')
    if os.path.exists(y_test_path):
        y_test = pd.read_csv(y_test_path)
        preds_multi_df["y_true"] = y_test["Label_Multiclass"]
        preds_multi_df["y_pred"] = y_pred_multi
    
    multi_preds_path = os.path.join(predictions_dir, "logreg_preds_multiclass.csv")
    preds_multi_df.to_csv(multi_preds_path, index=False)
    
    print(f"[+] Saved Multiclass Predictions to {multi_preds_path}")
    print(f"[*] Logistic Regression Training and Prediction Pipeline Complete!")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train and Evaluate the Multiclass Logistic Regression Model (Out-of-Core)")
    parser.add_argument("--input_X_train", type=str, default="data/processed/X_train.csv", help="Path to X_train.csv")
    parser.add_argument("--input_y_train", type=str, default="data/processed/y_train.csv", help="Path to y_train.csv")
    parser.add_argument("--input_X_test", type=str, default="data/processed/X_test.csv", help="Path to X_test.csv")
    parser.add_argument("--predictions_dir", type=str, default="predictions", help="Directory to save prediction CSVs")
    parser.add_argument("--model_save_dir", type=str, default="saved_models", help="Directory to save the pickled models")
    parser.add_argument("--plots_dir", type=str, default="evaluation_results/plots", help="Directory to save visualizations")
    
    args = parser.parse_args()
    
    train_and_predict_logreg(args.input_X_train, args.input_y_train, args.input_X_test, args.predictions_dir, args.model_save_dir, args.plots_dir)
