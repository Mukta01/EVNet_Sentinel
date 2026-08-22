from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
import joblib
import pandas as pd
import os

app = FastAPI(title="EVNet Sentinel ML API", version="1.0.0", description="API for predicting network attacks using Out-of-Core SVM Multiclass model")

# Global variables
models = {}
scaler = None
expected_features = None

# Model paths inside the docker container
MODELS_DIR = os.getenv("MODELS_DIR", "saved_models")
SCALER_PATH = os.getenv("SCALER_PATH", "saved_models/StandardScaler.pkl")

@app.on_event("startup")
def load_models():
    global models
    global scaler
    global expected_features
    try:
        print(f"[*] Loading scaler from {SCALER_PATH}")
        scaler = joblib.load(SCALER_PATH)
        print("[+] Scaler loaded successfully!")
        if hasattr(scaler, "feature_names_in_"):
            expected_features = list(scaler.feature_names_in_)
            print(f"[*] Scaler expects {len(expected_features)} features.")
            
        print(f"[*] Scanning {MODELS_DIR} for models...")
        for filename in os.listdir(MODELS_DIR):
            if filename.endswith(".pkl") and filename != "StandardScaler.pkl" and filename != "arf_adwin.pkl":
                model_name = filename.replace(".pkl", "")
                model_path = os.path.join(MODELS_DIR, filename)
                print(f"[*] Loading model: {model_name} from {model_path}")
                models[model_name] = joblib.load(model_path)
                
                # Try to extract expected features if scaler didn't have them
                if not expected_features and hasattr(models[model_name], "feature_names_in_"):
                    expected_features = list(models[model_name].feature_names_in_)
                    print(f"[*] Model {model_name} expects {len(expected_features)} features.")
                    
        print(f"[+] Loaded {len(models)} models: {list(models.keys())}")
        
    except Exception as e:
        print(f"[!] Error loading models/scaler: {e}")
        # We don't raise here, so the server can start and we can debug via the /health endpoint
        
class PredictionRequest(BaseModel):
    # A generic dictionary to hold the 39 features dynamically without hardcoding them in Pydantic
    features: dict
    # Optional model name to allow the frontend to specify which model to predict with
    model_name: str = "arfadwin_model"

@app.get("/")
def health_check():
    """ Health check endpoint to verify the API is running and the model is loaded. """
    return {
        "status": "healthy",
        "models_loaded": list(models.keys()),
        "scaler_loaded": scaler is not None,
        "scaler_path": SCALER_PATH
    }

@app.post("/predict")
def predict_attack(request: PredictionRequest):
    """
    Accepts a JSON payload of preprocessed network traffic features and returns the predicted attack class.
    """
    if not models:
        raise HTTPException(status_code=500, detail="No models are loaded on the server.")
    
    if request.model_name not in models:
        raise HTTPException(status_code=400, detail=f"Model '{request.model_name}' not found. Available models: {list(models.keys())}")
        
    model = models[request.model_name]
        
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
