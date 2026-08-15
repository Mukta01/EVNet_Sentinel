import os
import glob
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# ==============================================================================
# EPIC 1.1: DATA LOADING & CLEANING (Assignee: @shard-c6)
# ==============================================================================

def load_network_traffic_data(base_dir: str) -> pd.DataFrame:
    """
    Loads all CSV files from the given directory (which should point to the 
    'Network Traffic' folder of the CICEVSE2024 dataset).
    """
    all_files = glob.glob(os.path.join(base_dir, "**", "*.csv"), recursive=True)
    df_list = []
    
    for file in all_files:
        try:
            temp_df = pd.read_csv(file)
            filename = os.path.basename(file).lower()
            
            # If the CSV doesn't already have a 'Label' column, derive one from the filename.
            # Benign files typically have 'benign' or 'normal' in the name.
            if 'Label' not in temp_df.columns:
                if "benign" in filename or "normal" in filename:
                    temp_df['Label'] = "benign"
                else:
                    temp_df['Label'] = "attack"
            
            df_list.append(temp_df)
        except Exception as e:
            print(f"Warning: Could not read {file}: {e}")
            
    if not df_list:
        print(f"No CSV files found in {base_dir}")
        return pd.DataFrame()
        
    combined_df = pd.concat(df_list, ignore_index=True)
    return combined_df

def clean_and_reduce_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Cleans the massive DataFrame according to Makhmudov et al. (2025).
    """
    if df.empty:
        return df

    # The exact 19 columns identified as non-predictive or causing overfitting
    cols_to_drop = [
        'id', 'expiration_id', 'src_ip', 'src_mac', 'src_oui', 'dst_ip', 
        'dst_mac', 'dst_oui', 'vlan_id', 'tunnel_id', 'requested_server_name', 
        'client_fingerprint', 'server_fingerprint', 'user_agent', 'content_type',
        'application_name', 'application_category_name', 'application_is_guessed', 
        'application_confidence'
    ]
    
    # Only drop columns that actually exist to avoid KeyError
    existing_cols_to_drop = [col for col in cols_to_drop if col in df.columns]
    
    print(f"Dropping {len(existing_cols_to_drop)} non-predictive columns...")
    df = df.drop(columns=existing_cols_to_drop)
    
    initial_rows = len(df)
    df = df.drop_duplicates()
    final_rows = len(df)
    
    print(f"Dropped {initial_rows - final_rows} duplicate rows.")
    return df

# ==============================================================================
# EPIC 1.2: FEATURE ENGINEERING & SPLITTING (Assignee: @shrutich-30)
# ==============================================================================

def engineer_features(df: pd.DataFrame) -> tuple:
    """
    TODO (Shruti):
    1. Separate the features (X) from the target 'Label' (y).
    2. Initialize a StandardScaler()
    3. Apply the scaler to X to normalize all numerical features to zero mean 
       and unit variance.
    4. Return X, y
    """
    pass

def split_and_export_data(X, y, output_dir: str):
    """
    TODO (Shruti):
    1. Use train_test_split to create a 70% Train, 15% Validate, 15% Test split.
       (Hint: split 70/30 first, then split the 30 evenly in half).
    2. Ensure the output_dir exists.
    3. Save X_train.csv, y_train.csv, X_val.csv, etc. into output_dir.
    """
    pass

# ==============================================================================
# ORCHESTRATOR
# ==============================================================================

def main():
    # Update this path to where your extracted CICEVSE2024 Dataset lives locally
    RAW_DATA_DIR = "datasets/CICEVSE2024_Dataset/Network Traffic/" 
    PROCESSED_DIR = "data/processed/"
    
    print("Starting Epic 1 Pipeline...")
    
    print("[1/4] Loading and concatenating network traffic data...")
    df = load_network_traffic_data(RAW_DATA_DIR)
    
    print("[2/4] Cleaning and reducing features...")
    df = clean_and_reduce_features(df)
    
    print("[3/4] Engineering and scaling features...")
    X, y = engineer_features(df)
    
    print("[4/4] Splitting and exporting data (70/15/15)...")
    split_and_export_data(X, y, PROCESSED_DIR)
    
    print("✅ Preprocessing complete! Files saved to data/processed/")

if __name__ == "__main__":
    main()
