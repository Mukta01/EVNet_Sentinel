import pandas as pd
from sklearn.svm import LinearSVC
import joblib
import os

def main():
    # 1. Load Data
    print("Loading datasets...")
    # Assuming the script is run from the project root
    base_dir = "data/processed"
    
    if not os.path.exists(base_dir):
        raise FileNotFoundError(f"Directory '{base_dir}' not found. Ensure you are running this from the project root and Epic 1 is complete.")

    X_train = pd.read_csv(os.path.join(base_dir, "X_train.csv"))
    y_train = pd.read_csv(os.path.join(base_dir, "y_train.csv"))
    X_val = pd.read_csv(os.path.join(base_dir, "X_val.csv"))
    y_val = pd.read_csv(os.path.join(base_dir, "y_val.csv"))
    X_test = pd.read_csv(os.path.join(base_dir, "X_test.csv"))

    # Extract both target variables
    y_train_binary = y_train["Label_Binary"]
    y_train_multi = y_train["Label_Multiclass"]

    # 2. Train Models
    print("Training Binary SVM model...")
    model_binary = LinearSVC(random_state=42, dual=False, max_iter=1000)
    model_binary.fit(X_train, y_train_binary)

    print("Training Multiclass SVM model...")
    model_multi = LinearSVC(random_state=42, dual=False, max_iter=1000)
    model_multi.fit(X_train, y_train_multi)

    # 3. Save Models
    os.makedirs("saved_models", exist_ok=True)
    joblib.dump(model_binary, "saved_models/svm_model_binary.pkl")
    joblib.dump(model_multi, "saved_models/svm_model_multiclass.pkl")
    print("Models saved to 'saved_models/' directory.")

    # 4. Generate & Save Predictions
    print("Generating predictions...")
    os.makedirs("predictions", exist_ok=True)

    # Binary Validation & Test Predictions
    pd.DataFrame({"Prediction_Binary": model_binary.predict(X_val)}).to_csv("predictions/svm_preds_binary_val.csv", index=False)
    pd.DataFrame({"Prediction_Binary": model_binary.predict(X_test)}).to_csv("predictions/svm_preds_binary_test.csv", index=False)

    # Multiclass Validation & Test Predictions
    pd.DataFrame({"Prediction_Multiclass": model_multi.predict(X_val)}).to_csv("predictions/svm_preds_multiclass_val.csv", index=False)
    pd.DataFrame({"Prediction_Multiclass": model_multi.predict(X_test)}).to_csv("predictions/svm_preds_multiclass_test.csv", index=False)
    print("Predictions saved to 'predictions/' directory.")

if __name__ == "__main__":
    main()
