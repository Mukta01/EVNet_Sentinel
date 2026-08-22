from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import os

app = FastAPI(title="EVNet Sentinel ML API", version="1.0.0", description="API for predicting network attacks using Out-of-Core SVM Multiclass model")

# Global variable to hold the model and scaler
model = None
scaler = None
# We will get the expected feature columns when the model is loaded
expected_features = None

# Model paths inside the docker container
MODEL_PATH = os.getenv("MODEL_PATH", "saved_models/svm_model_multiclass.pkl")
SCALER_PATH = os.getenv("SCALER_PATH", "saved_models/StandardScaler.pkl")

@app.on_event("startup")
def load_model():
    global model
    global scaler
    global expected_features
    try:
        print(f"[*] Loading model from {MODEL_PATH}")
        model = joblib.load(MODEL_PATH)
        print("[+] Model loaded successfully!")
        
        print(f"[*] Loading scaler from {SCALER_PATH}")
        scaler = joblib.load(SCALER_PATH)
        print("[+] Scaler loaded successfully!")
        
        # If the model has feature names (scikit-learn >= 1.0), we can extract them for validation
        if hasattr(model, "feature_names_in_"):
            expected_features = list(model.feature_names_in_)
            print(f"[*] Model expects {len(expected_features)} features.")
        elif hasattr(scaler, "feature_names_in_"):
            expected_features = list(scaler.feature_names_in_)
            print(f"[*] Scaler expects {len(expected_features)} features.")
    except Exception as e:
        print(f"[!] Error loading model/scaler: {e}")
        # We don't raise here, so the server can start and we can debug via the /health endpoint
        
class PredictionRequest(BaseModel):
    # A generic dictionary to hold the 39 features dynamically without hardcoding them in Pydantic
    features: dict

@app.get("/")
def health_check():
    """ Health check endpoint to verify the API is running and the model is loaded. """
    return {
        "status": "healthy",
        "model_loaded": model is not None,
        "scaler_loaded": scaler is not None,
        "model_path": MODEL_PATH,
        "scaler_path": SCALER_PATH
    }

@app.post("/predict")
def predict_attack(request: PredictionRequest):
    """
    Accepts a JSON payload of preprocessed network traffic features and returns the predicted attack class.
    """
    if model is None:
        raise HTTPException(status_code=500, detail="Model is not loaded on the server.")
        
    try:
        # Convert dictionary to a 1-row Pandas DataFrame
        df = pd.DataFrame([request.features])
        
        # If the model has expected feature names, ensure the columns match the exact order
        if expected_features:
            # Check for missing features
            missing = set(expected_features) - set(df.columns)
            if missing:
                # Let's fill missing features with 0 for robustness, or raise error
                for m in missing:
                    df[m] = 0
            
            # Reorder columns to match the training data exactly
            df = df[expected_features]
            
        # Scale features
        if scaler is not None:
            # print("df columns:", df.columns.tolist())
            # print("scaler columns:", list(scaler.feature_names_in_))
            df_scaled = scaler.transform(df)
            df = pd.DataFrame(df_scaled, columns=df.columns)
            
        # Run prediction
        # For ARF, we need to pass a dict
        if hasattr(model, "predict_one"):
            prediction = [model.predict_one(df.iloc[0].to_dict())]
        else:
            prediction = model.predict(df)
        
        return {
            "prediction_class": str(prediction[0]),
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
