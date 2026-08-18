"""
SVM Model Training Script for EVNet Sentinel.

Trains a static Support Vector Machine classifier on the preprocessed CICEVSE2024 dataset.
"""

import os
import logging
import joblib
import pandas as pd
from sklearn.svm import LinearSVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, confusion_matrix, classification_report

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

PROCESSED_DATA_DIR = "data/processed"
MODEL_SAVE_DIR = "saved_models"
PREDICTIONS_DIR = "predictions"


def load_data(data_dir: str):
    """Loads train, validation, and test sets."""
    logger.info(f"Loading preprocessed data from '{data_dir}'...")
    try:
        X_train = pd.read_csv(os.path.join(data_dir, "X_train.csv"))
        y_train = pd.read_csv(os.path.join(data_dir, "y_train.csv"))
        
        X_val = pd.read_csv(os.path.join(data_dir, "X_val.csv"))
        y_val = pd.read_csv(os.path.join(data_dir, "y_val.csv"))
        
        X_test = pd.read_csv(os.path.join(data_dir, "X_test.csv"))
        y_test = pd.read_csv(os.path.join(data_dir, "y_test.csv"))
        
        logger.info(f"Loaded successfully. X_train shape: {X_train.shape}")
        
        y_train_binary = y_train["Label_Binary"].values.ravel()
        y_train_multi = y_train["Label_Multiclass"].values.ravel()
        y_val_binary = y_val["Label_Binary"].values.ravel()
        y_val_multi = y_val["Label_Multiclass"].values.ravel()
        y_test_binary = y_test["Label_Binary"].values.ravel()
        y_test_multi = y_test["Label_Multiclass"].values.ravel()

        return (X_train, y_train_binary, y_train_multi,
                X_val, y_val_binary, y_val_multi,
                X_test, y_test_binary, y_test_multi)
    except FileNotFoundError as e:
        logger.error(f"Data files not found. Ensure preprocess.py has been run. Details: {e}")
        raise


def evaluate_model(model, X, y, dataset_name="Validation", is_multiclass=False):
    """Evaluates the model and logs metrics."""
    logger.info(f"Evaluating on {dataset_name} set...")
    preds = model.predict(X)
    
    avg_method = 'weighted' if is_multiclass else 'binary'
    
    acc = accuracy_score(y, preds)
    prec = precision_score(y, preds, average=avg_method, zero_division=0)
    rec = recall_score(y, preds, average=avg_method, zero_division=0)
    f1 = f1_score(y, preds, average=avg_method, zero_division=0)
    
    logger.info(f"--- {dataset_name} Metrics ---")
    logger.info(f"Accuracy:  {acc:.4f}")
    logger.info(f"Precision: {prec:.4f}")
    logger.info(f"Recall:    {rec:.4f}")
    logger.info(f"F1-score:  {f1:.4f}")
    
    return preds


def main():
    # 1. Load Data
    (X_train, y_train_binary, y_train_multi,
     X_val, y_val_binary, y_val_multi,
     X_test, y_test_binary, y_test_multi) = load_data(PROCESSED_DATA_DIR)

    # Ensure directories exist
    os.makedirs(MODEL_SAVE_DIR, exist_ok=True)
    os.makedirs(PREDICTIONS_DIR, exist_ok=True)

    # 2. Train Models
    logger.info("Training Binary SVM model...")
    model_binary = LinearSVC(random_state=42, dual=False, max_iter=1000)
    model_binary.fit(X_train, y_train_binary)

    logger.info("Training Multiclass SVM model...")
    model_multi = LinearSVC(random_state=42, dual=False, max_iter=1000)
    model_multi.fit(X_train, y_train_multi)

    # 3. Evaluate & Save Predictions (Binary)
    logger.info("=== Binary Model Evaluation ===")
    preds_val_bin = evaluate_model(model_binary, X_val, y_val_binary, "Validation")
    preds_test_bin = evaluate_model(model_binary, X_test, y_test_binary, "Test")
    
    pd.DataFrame({"Prediction_Binary": preds_val_bin}).to_csv(os.path.join(PREDICTIONS_DIR, "svm_preds_binary_val.csv"), index=False)
    pd.DataFrame({"Prediction_Binary": preds_test_bin}).to_csv(os.path.join(PREDICTIONS_DIR, "svm_preds_binary_test.csv"), index=False)

    # 4. Evaluate & Save Predictions (Multiclass)
    logger.info("=== Multiclass Model Evaluation ===")
    preds_val_multi = evaluate_model(model_multi, X_val, y_val_multi, "Validation", is_multiclass=True)
    preds_test_multi = evaluate_model(model_multi, X_test, y_test_multi, "Test", is_multiclass=True)
    
    pd.DataFrame({"Prediction_Multiclass": preds_val_multi}).to_csv(os.path.join(PREDICTIONS_DIR, "svm_preds_multiclass_val.csv"), index=False)
    pd.DataFrame({"Prediction_Multiclass": preds_test_multi}).to_csv(os.path.join(PREDICTIONS_DIR, "svm_preds_multiclass_test.csv"), index=False)

    # 5. Save Models
    logger.info("Saving models...")
    joblib.dump(model_binary, os.path.join(MODEL_SAVE_DIR, "svm_model_binary.pkl"))
    joblib.dump(model_multi, os.path.join(MODEL_SAVE_DIR, "svm_model_multiclass.pkl"))
    logger.info("SVM Training and Evaluation complete.")


if __name__ == "__main__":
    main()
