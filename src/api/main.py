from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import os

app = FastAPI(title="EVNet Sentinel ML API", version="1.0.0", description="API for predicting network attacks using Out-of-Core SVM Multiclass model")

# Global variable to hold the model
model = None
# We will get the expected feature columns when the model is loaded
expected_features = None

# Model path inside the docker container
MODEL_PATH = os.getenv("MODEL_PATH", "saved_models/svm_model_multiclass.pkl")

@app.on_event("startup")
def load_model():
    global model
    global expected_features
    try:
        print(f"[*] Loading model from {MODEL_PATH}")
        model = joblib.load(MODEL_PATH)
        print("[+] Model loaded successfully!")
        # If the model has feature names (scikit-learn >= 1.0), we can extract them for validation
        if hasattr(model, "feature_names_in_"):
            expected_features = list(model.feature_names_in_)
            print(f"[*] Model expects {len(expected_features)} features.")
    except Exception as e:
        print(f"[!] Error loading model: {e}")
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
        "model_path": MODEL_PATH
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
                raise HTTPException(status_code=400, detail=f"Missing expected features: {missing}")
            
            # Reorder columns to match the training data exactly
            df = df[expected_features]
            
        # Run prediction
        prediction = model.predict(df)
        
        return {
            "prediction_class": str(prediction[0]),
            "status": "success"
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction failed: {str(e)}")
