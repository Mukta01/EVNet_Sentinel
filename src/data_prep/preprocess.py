"""
Centralized Data Preprocessing Script for EVNet Sentinel.

Reproduces and standardizes the data preprocessing pipeline from Makhmudov et al. (2025)
for the CICEVSE2024 Network Traffic dataset.
"""

import argparse
import glob
import logging
import os
from typing import Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

# List of 19 feature columns to drop (+ Label separated into y = 20 total dropped columns)
DROP_COLUMNS = [
    # Identifiers
    "id",
    "expiration_id",
    # Network Addresses (environment-specific, overfits to testbed)
    "src_ip",
    "src_mac",
    "src_oui",
    "dst_ip",
    "dst_mac",
    "dst_oui",
    # Zero / Near-Zero Variance
    "vlan_id",
    "tunnel_id",
    # String Metadata (sparse / empty in EV protocols)
    "requested_server_name",
    "client_fingerprint",
    "server_fingerprint",
    "user_agent",
    "content_type",
    # Application Layer DPI (redundant with transport protocol)
    "application_name",
    "application_category_name",
    "application_is_guessed",
    "application_confidence",
]


def load_network_traffic_data(base_dir: str = "data/raw") -> pd.DataFrame:
    """
    Finds and loads all CSV files from Network Traffic subdirectories.
    
    Args:
        base_dir (str): Base directory where raw CSV datasets reside.
        
    Returns:
        pd.DataFrame: Concatenated raw dataset.
    """
    logger.info(f"Scanning for CSV files in '{base_dir}'...")
    
    if not os.path.exists(base_dir):
        logger.warning(f"Directory '{base_dir}' does not exist. Returning empty DataFrame.")
        return pd.DataFrame()

    csv_files = glob.glob(os.path.join(base_dir, "Network Traffic", "**", "*.csv"), recursive=True)
    
    if not csv_files:
        logger.warning(f"No CSV files found in '{base_dir}'. Returning empty DataFrame.")
        return pd.DataFrame()

    logger.info(f"Found {len(csv_files)} CSV file(s). Loading and concatenating...")
    df_list = []
    for file_path in csv_files:
        try:
            df = pd.read_csv(file_path, low_memory=False)
            df_list.append(df)
        except Exception as e:
            logger.error(f"Failed to read '{file_path}': {e}")

    if not df_list:
        return pd.DataFrame()

    combined_df = pd.concat(df_list, ignore_index=True)
    logger.info(f"Successfully loaded combined dataset with shape {combined_df.shape}.")
    return combined_df


def clean_and_reduce_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drops identified non-predictive/identifier columns and duplicate rows.
    Cleans infinite and NaN values.
    
    Args:
        df (pd.DataFrame): Raw input DataFrame.
        
    Returns:
        pd.DataFrame: Cleaned and feature-reduced DataFrame.
    """
    if df.empty:
        logger.warning("Empty DataFrame passed to clean_and_reduce_features.")
        return df.copy()

    initial_shape = df.shape
    logger.info(f"Starting cleaning on DataFrame with shape {initial_shape}.")

    # Drop duplicate rows
    cleaned_df = df.drop_duplicates().copy()
    logger.info(f"Dropped {initial_shape[0] - cleaned_df.shape[0]} duplicate rows.")

    # Identify columns to drop that actually exist in the DataFrame
    existing_drop_cols = [col for col in DROP_COLUMNS if col in cleaned_df.columns]
    if existing_drop_cols:
        cleaned_df.drop(columns=existing_drop_cols, inplace=True)
        logger.info(f"Dropped {len(existing_drop_cols)} specified feature columns.")

    # Replace +/- infinity with NaN and handle NaNs for numeric features
    numeric_cols = cleaned_df.select_dtypes(include=[np.number]).columns
    cleaned_df[numeric_cols] = cleaned_df[numeric_cols].replace([np.inf, -np.inf], np.nan)
    cleaned_df[numeric_cols] = cleaned_df[numeric_cols].fillna(0)

    logger.info(f"Cleaning complete. Output shape: {cleaned_df.shape}.")
    return cleaned_df


def engineer_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame]:
    """
    Extracts binary and multiclass target labels ('Label').
    Safely coerces remaining features to numeric to prevent data dropping.
    (Note: Scaling is intentionally delayed until after data splitting to prevent data leakage).
    
    Args:
        df (pd.DataFrame): Cleaned DataFrame containing features and 'Label'.
        
    Returns:
        Tuple[pd.DataFrame, pd.DataFrame]: (X_numeric, y_combined)
    """
    if df.empty:
        logger.warning("Empty DataFrame passed to engineer_features.")
        return pd.DataFrame(), pd.DataFrame()

    if "Label" not in df.columns:
        raise KeyError("Input DataFrame is missing required target column 'Label'.")

    # Extract target label
    y_raw = df["Label"]
    
    def standardize_multiclass(val):
        if pd.isna(val):
            return "benign"
        v = str(val).lower().strip()
        # Map common variations
        mapping = {
            "portscan": "port-scan",
            "syn-stealth-scan": "syn-stealth",
            "synonymous-ip-flood": "synonymous-ip",
            "service-detection-scan": "service-detection",
            "aggressive-scan": "aggressive-scan",
            "slowloris-scan": "slowloris-scan",
            "benign": "benign"
        }
        return mapping.get(v, v)
        
    # Multiclass encoding (standardize strings, fill NaNs with benign)
    y_multiclass = y_raw.apply(standardize_multiclass)
    
    # Binary encoding: 'benign' -> 0, all attacks -> 1
    def encode_label(val):
        if pd.isna(val):
            return 0
        v = str(val).lower().strip()
        if v in ["benign", "0", "false", "normal"]:
            return 0
        return 1

    y_binary = y_raw.apply(encode_label).astype(int)

    y_combined = pd.DataFrame({
        "Label_Binary": y_binary,
        "Label_Multiclass": y_multiclass
    })

    # Separate feature matrix X
    X_raw = df.drop(columns=["Label"], errors="ignore").copy()

    # Safely coerce all remaining features to numeric (prevent dirty strings from dropping features)
    for col in X_raw.columns:
        X_raw[col] = pd.to_numeric(X_raw[col], errors='coerce')
    
    # Fill any NaNs introduced by coercion
    X_raw.fillna(0, inplace=True)
    X_numeric = X_raw

    if X_numeric.empty:
        logger.warning("No numeric features available.")
        return X_numeric, y_combined

    logger.info(f"Engineered features for {X_numeric.shape[0]} rows across {X_numeric.shape[1]} features.")
    logger.info(f"Target distribution: Benign (0)={sum(y_binary == 0)}, Attack (1)={sum(y_binary == 1)}.")

    return X_numeric, y_combined


def split_and_export_data(
    X: pd.DataFrame,
    y: pd.DataFrame,
    output_dir: str = "data/processed"
) -> None:
    """
    Splits the cleaned data into 70% Train, 15% Validation, and 15% Test.
    Applies StandardScaler fit ONLY on the training set to prevent data leakage,
    then transforms all three sets.
    Exports resulting 6 CSV files to output_dir.
    
    Args:
        X (pd.DataFrame): Unscaled numerical feature matrix.
        y (pd.DataFrame): Target labels (binary and multiclass).
        output_dir (str): Destination directory for processed CSV files.
    """
    if X.empty or y.empty:
        logger.warning("Empty features or target passed to split_and_export_data. Skipping export.")
        return

    os.makedirs(output_dir, exist_ok=True)

    # Use the multiclass label for stratification if possible to ensure rare attacks are split properly
    stratify_target = y["Label_Multiclass"]
    
    # Determine if stratification is possible for the first split
    class_counts_first = stratify_target.value_counts()
    can_stratify_first = len(class_counts_first) > 1 and all(count >= 2 for count in class_counts_first)
    stratify_first = stratify_target if can_stratify_first else None

    # First split: 70% train, 30% temp
    X_train_raw, X_temp_raw, y_train, y_temp = train_test_split(
        X, y,
        test_size=0.30,
        random_state=42,
        stratify=stratify_first
    )

    # Determine if stratification is possible for the second split on temp subset
    stratify_temp_target = y_temp["Label_Multiclass"]
    class_counts_second = stratify_temp_target.value_counts()
    can_stratify_second = len(class_counts_second) > 1 and all(count >= 2 for count in class_counts_second)
    stratify_second = stratify_temp_target if can_stratify_second else None

    # Second split: split 30% temp equally into 15% validation and 15% test
    X_val_raw, X_test_raw, y_val, y_test = train_test_split(
        X_temp_raw, y_temp,
        test_size=0.50,
        random_state=42,
        stratify=stratify_second
    )

    logger.info(
        f"Data split ratios -> Train: {len(X_train_raw)} ({len(X_train_raw)/len(X):.1%}), "
        f"Val: {len(X_val_raw)} ({len(X_val_raw)/len(X):.1%}), "
        f"Test: {len(X_test_raw)} ({len(X_test_raw)/len(X):.1%})"
    )

    # Apply StandardScaler (Fit ONLY on training data!)
    logger.info("Applying StandardScaler (fitted on training data only) to prevent data leakage...")
    scaler = StandardScaler()
    
    # Save the scaler to saved_models/
    import pickle
    model_dir = os.path.join(PROJECT_ROOT if 'PROJECT_ROOT' in locals() else os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "saved_models")
    os.makedirs(model_dir, exist_ok=True)
    scaler_path = os.path.join(model_dir, "StandardScaler.pkl")
    
    X_train_scaled = scaler.fit_transform(X_train_raw)
    
    with open(scaler_path, 'wb') as f:
        pickle.dump(scaler, f)
    logger.info(f"Saved StandardScaler to {scaler_path}")
    
    X_train = pd.DataFrame(
        X_train_scaled,
        columns=X_train_raw.columns,
        index=X_train_raw.index
    )
    
    X_val = pd.DataFrame(
        scaler.transform(X_val_raw),
        columns=X_val_raw.columns,
        index=X_val_raw.index
    )
    
    X_test = pd.DataFrame(
        scaler.transform(X_test_raw),
        columns=X_test_raw.columns,
        index=X_test_raw.index
    )

    # Export CSVs
    X_train.to_csv(os.path.join(output_dir, "X_train.csv"), index=False)
    y_train.to_csv(os.path.join(output_dir, "y_train.csv"), index=False)
    X_val.to_csv(os.path.join(output_dir, "X_val.csv"), index=False)
    y_val.to_csv(os.path.join(output_dir, "y_val.csv"), index=False)
    X_test.to_csv(os.path.join(output_dir, "X_test.csv"), index=False)
    y_test.to_csv(os.path.join(output_dir, "y_test.csv"), index=False)

    logger.info(f"Successfully exported 6 dataset CSV files to '{output_dir}'.")


def main():
    """
    Pipeline Orchestrator for Centralized Preprocessing.
    """
    parser = argparse.ArgumentParser(description="EVNet Sentinel Data Preprocessing Pipeline")
    parser.add_argument("--raw_dir", type=str, default="data/raw", help="Path to raw dataset directory")
    parser.add_argument("--output_dir", type=str, default="data/processed", help="Path to processed output directory")
    args = parser.parse_args()

    logger.info("--- Starting EVNet Sentinel Preprocessing Pipeline ---")
    df = load_network_traffic_data(base_dir=args.raw_dir)
    
    if df.empty:
        logger.warning("No data found to process. Exiting pipeline.")
        return

    df_cleaned = clean_and_reduce_features(df)
    X_numeric, y_combined = engineer_features(df_cleaned)
    split_and_export_data(X_numeric, y_combined, output_dir=args.output_dir)
    logger.info("--- Pipeline Completed Successfully ---")


if __name__ == "__main__":
    main()
