import os
import joblib
import pickle
import pandas as pd
from river import ensemble
from sklearn.metrics import classification_report, accuracy_score
import time

def evaluate_arfadwin():
    print("Starting ARF-ADWIN evaluation...")
    
    # Paths
    base_dir = os.path.dirname(os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
    data_dir = os.path.join(base_dir, "data", "processed")
    models_dir = os.path.join(base_dir, "saved_models")
    preds_dir = os.path.join(base_dir, "predictions")
    
    x_test_path = os.path.join(data_dir, "X_test.csv")
    y_test_path = os.path.join(data_dir, "y_test.csv")
    model_path = os.path.join(models_dir, "arfadwin_model.pkl")
    
    # Check if files exist
    if not os.path.exists(x_test_path) or not os.path.exists(y_test_path):
        print(f"Test data not found at {data_dir}. Please run preprocessing first.")
        return
        
    if not os.path.exists(model_path):
        print("Model not found. Please run training first.")
        return

    # Load model
    with open(model_path, "rb") as f:
        model = pickle.load(f)
    print("Loaded ARF-ADWIN model successfully.")

    chunksize = 100000
    total_processed = 0
    start_time = time.time()
    
    y_true_all = []
    y_pred_all = []
    
    print(f"Reading test data in chunks of {chunksize}...")
    
    x_iter = pd.read_csv(x_test_path, chunksize=chunksize)
    y_iter = pd.read_csv(y_test_path, chunksize=chunksize)

    try:
        for chunk_idx, (X_chunk, y_chunk) in enumerate(zip(x_iter, y_iter)):
            # Ensure the labels are a single series
            if isinstance(y_chunk, pd.DataFrame):
                y_chunk = y_chunk.iloc[:, 0]
                
            # Data is already scaled in X_test.csv
            
            # Convert to dictionary records for river
            x_dict_list = X_chunk.to_dict(orient="records")
            y_list = y_chunk.tolist()
            
            # Predict row by row
            chunk_preds = []
            for x_dict in x_dict_list:
                pred = model.predict_one(x_dict)
                # If model hasn't learned enough, it might return None or a default class
                if pred is None:
                    # Fallback to the majority class or 0
                    pred = 0
                chunk_preds.append(pred)
                
            y_true_all.extend(y_list)
            y_pred_all.extend(chunk_preds)
                
            total_processed += len(X_chunk)
            elapsed = time.time() - start_time
            print(f"Chunk {chunk_idx + 1} processed. Total rows: {total_processed}. Elapsed: {elapsed:.2f}s")
            
            # For demonstration and to keep CI time reasonable, we'll break after 5 chunks
            if chunk_idx >= 4:
                print("Stopping early after 500,000 rows for demonstration purposes.")
                break
                
    except StopIteration:
        pass
        
    print(f"Evaluation completed. Total rows processed: {total_processed}")
    
    # Save predictions
    os.makedirs(preds_dir, exist_ok=True)
    preds_save_path = os.path.join(preds_dir, "arfadwin_preds_multiclass.csv")
    
    preds_df = pd.DataFrame({"Actual": y_true_all, "Predicted": y_pred_all})
    preds_df.to_csv(preds_save_path, index=False)
    print(f"Predictions saved to {preds_save_path}")
    
    # Print metrics
    print("\n" + "="*50)
    print("ARF-ADWIN MODEL EVALUATION METRICS")
    print("="*50)
    acc = accuracy_score(y_true_all, y_pred_all)
    print(f"Accuracy: {acc:.4f}\n")
    print("Classification Report:")
    print(classification_report(y_true_all, y_pred_all, digits=4))
    print("="*50)

if __name__ == "__main__":
    evaluate_arfadwin()
