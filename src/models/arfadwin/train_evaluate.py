import argparse
import os
import json
import pickle
import pandas as pd
from river import forest
from river import preprocessing
from river import drift
from river import metrics
from river import stream

def run_arf_adwin_pipeline(data_path, is_full_run, limit_rows, output_dir, model_save_dir):
    """
    Trains and evaluates the ARF+ADWIN model prequentially (predict-then-learn).
    """
    os.makedirs(output_dir, exist_ok=True)
    os.makedirs(model_save_dir, exist_ok=True)
    
    print(f"[*] Initializing ARF + ADWIN Pipeline...")
    
    # 1. Initialize Pipeline (StandardScaler -> ARF with ADWIN)
    # The paper uses: n_models=20, max_features=0.5, grace_period=30, ADWIN(delta=0.002)
    scaler = preprocessing.StandardScaler()
    
    arf = forest.ARFClassifier(
        n_models=20,
        max_features=0.5, # 50% of features
        grace_period=30,
        leaf_prediction='nba', # Naive Bayes Adaptive
        drift_detector=drift.ADWIN(delta=0.002),
        warning_detector=drift.ADWIN(delta=0.002) # Standard ARF setup uses same for warnings
    )
    
    model_pipeline = scaler | arf
    
    # Track standalone drift events for the dashboard visualization
    drift_detector_log = drift.ADWIN(delta=0.002)
    drift_events = []
    
    # Tracking metrics
    accuracy_tracker = metrics.Accuracy()
    
    # Storing predictions for evaluation script
    y_true_list = []
    y_pred_list = []
    
    print(f"[*] Loading data from {data_path}...")
    
    # Using Pandas in chunks to stream data efficiently
    chunksize = 10000
    row_count = 0
    max_rows = limit_rows if not is_full_run else float('inf')
    
    print(f"[*] Starting Prequential Training... (Target Max Rows: {max_rows})")
    
    # Use pandas chunking to simulate a data stream
    for chunk in pd.read_csv(data_path, chunksize=chunksize):
        
        # If we exceeded the limit (development mode), stop processing
        if row_count >= max_rows:
            break
            
        # Ensure we don't process more than max_rows
        if row_count + len(chunk) > max_rows:
            chunk = chunk.iloc[:int(max_rows - row_count)]
            
        # The target column is 'Label' based on the feature engineering docs
        if 'Label' not in chunk.columns:
            # Fallback if testing with mock data
            target_col = 'y_true' if 'y_true' in chunk.columns else chunk.columns[-1]
        else:
            target_col = 'Label'
            
        X_df = chunk.drop(columns=[target_col])
        y_series = chunk[target_col]
        
        # Convert to dictionary format for river
        for x, y in stream.iter_frame(X_df, y_series):
            # 1. Predict
            y_pred = model_pipeline.predict_one(x)
            
            # Record for external evaluation later
            y_true_list.append(y)
            y_pred_list.append(y_pred if y_pred is not None else y) # Fallback for first prediction
            
            if y_pred is not None:
                # 2. Update Metric
                accuracy_tracker.update(y, y_pred)
                
                # 3. Check for Concept Drift
                # ADWIN tracks the error rate (1 if correct, 0 if wrong)
                is_correct = 1.0 if y == y_pred else 0.0
                drift_detector_log.update(is_correct)
                
                if drift_detector_log.drift_detected:
                    print(f"[!] Concept Drift Detected at instance {row_count} | Current Accuracy: {accuracy_tracker.get():.4f}")
                    drift_events.append({
                        "instance": row_count,
                        "accuracy_at_drift": accuracy_tracker.get()
                    })
            
            # 4. Learn
            model_pipeline.learn_one(x, y)
            
            row_count += 1
            
            if row_count % 10000 == 0:
                print(f"Processed {row_count} instances... Current Accuracy: {accuracy_tracker.get():.4f}")

    print(f"\n[*] Processing Complete. Total Rows: {row_count}")
    print(f"[*] Final Rolling Accuracy: {accuracy_tracker.get():.4f}")
    print(f"[*] Total Drift Events Detected: {len(drift_events)}")
    
    # -----------------------------------------
    # Save Outputs
    # -----------------------------------------
    
    # 1. Save Predictions CSV (For Epic 4 Unified Evaluation Script)
    pred_df = pd.DataFrame({
        'y_true': y_true_list,
        'y_pred': y_pred_list
    })
    pred_path = os.path.join(output_dir, 'arf_adwin_predictions.csv')
    pred_df.to_csv(pred_path, index=False)
    print(f"[+] Saved predictions to {pred_path}")
    
    # 2. Save Drift Events JSON (For Dashboard Integration)
    drift_path = os.path.join(output_dir, 'arf_adwin_drift_events.json')
    with open(drift_path, 'w') as f:
        json.dump(drift_events, f, indent=4)
    print(f"[+] Saved drift events to {drift_path}")
    
    # 3. Save Model Weights
    model_path = os.path.join(model_save_dir, 'arf_adwin.pkl')
    with open(model_path, 'wb') as f:
        pickle.dump(model_pipeline, f)
    print(f"[+] Saved model to {model_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train and Evaluate the ARF+ADWIN Online Learning Model")
    parser.add_argument("--input", type=str, required=True, help="Path to the preprocessed dataset CSV")
    parser.add_argument("--full", action="store_true", help="If set, processes the entire dataset. Otherwise uses a subset.")
    parser.add_argument("--limit", type=int, default=50000, help="Number of rows to process if not running in full mode.")
    parser.add_argument("--output_dir", type=str, default="predictions", help="Directory to save predictions and logs")
    parser.add_argument("--model_save_dir", type=str, default="saved_models", help="Directory to save the pickled model")
    
    args = parser.parse_args()
    
    run_arf_adwin_pipeline(args.input, args.full, args.limit, args.output_dir, args.model_save_dir)
