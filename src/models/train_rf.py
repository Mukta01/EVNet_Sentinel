"""
Random Forest Model Training Script for EVNet Sentinel.

Trains a static Random Forest classifier on the preprocessed CICEVSE2024 dataset.
"""

import os
import logging
import joblib
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
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
        return X_train, y_train["Label_Binary"].values.ravel(), X_val, y_val["Label_Binary"].values.ravel(), X_test, y_test["Label_Binary"].values.ravel()
    except FileNotFoundError as e:
        logger.error(f"Data files not found. Ensure preprocess.py has been run. Details: {e}")
        raise


def evaluate_model(model, X_test, y_test):
    """Evaluates the model on the test set and prints metrics."""
    logger.info("Evaluating model on the test set...")
    y_pred = model.predict(X_test)
    
    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    
    logger.info("--- Test Set Evaluation ---")
    logger.info(f"Accuracy:  {acc:.4f}")
    logger.info(f"Precision: {prec:.4f}")
    logger.info(f"Recall:    {rec:.4f}")
    logger.info(f"F1-Score:  {f1:.4f}")
    logger.info("---------------------------")
    
    logger.info("Confusion Matrix:")
    cm = confusion_matrix(y_test, y_pred)
    logger.info(f"\n{cm}")
    
    logger.info("Classification Report:")
    logger.info(f"\n{classification_report(y_test, y_pred, zero_division=0)}")
    
    return y_pred


def save_predictions(y_pred, y_test, output_dir: str):
    """Saves predictions alongside true labels for standardized evaluation."""
    os.makedirs(output_dir, exist_ok=True)
    out_path = os.path.join(output_dir, "rf_predictions.csv")
    
    df_out = pd.DataFrame({
        "True_Label": y_test,
        "Predicted_Label": y_pred
    })
    df_out.to_csv(out_path, index=False)
    logger.info(f"Predictions saved to '{out_path}'.")


def main():
    logger.info("=== Starting Random Forest Training Pipeline ===")
    
    # 1. Load Data
    X_train, y_train, X_val, y_val, X_test, y_test = load_data(PROCESSED_DATA_DIR)
    
    # 2. Train Model
    logger.info("Initializing RandomForestClassifier...")
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=15,
        random_state=42,
        n_jobs=-1  # Use all available cores
    )
    
    logger.info("Training the model (this may take some time)...")
    rf_model.fit(X_train, y_train)
    logger.info("Training completed.")
    
    # 3. Evaluate Model
    y_pred = evaluate_model(rf_model, X_test, y_test)
    
    # 4. Save Model & Predictions
    os.makedirs(MODEL_SAVE_DIR, exist_ok=True)
    model_path = os.path.join(MODEL_SAVE_DIR, "random_forest.pkl")
    logger.info(f"Saving trained model to '{model_path}'...")
    joblib.dump(rf_model, model_path)
    
    save_predictions(y_pred, y_test, PREDICTIONS_DIR)
    
    logger.info("=== Random Forest Training Pipeline Finished ===")


if __name__ == "__main__":
    main()
