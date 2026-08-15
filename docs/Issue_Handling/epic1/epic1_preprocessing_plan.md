# Epic 1: Centralized Data Preprocessing Implementation Plan (Revised)

This implementation plan merges the extensive dataset analysis found in `docs/dataset_feature_engineering.md` with the execution strategy required for **Epic 1**. 

## User Review Required

> [!IMPORTANT]  
> **Final Review Before Execution**
> I have reconciled this plan with the detailed document at `docs/dataset_feature_engineering.md`. Please review the revised functional split and the detailed column-dropping logic below. Once approved, I will immediately execute this plan and create `src/data_prep/preprocess.py`.

## Proposed Changes

We will build the data pipeline in `src/data_prep/preprocess.py`. This script will parse the `Network Traffic` subset of the CICEVSE2024 dataset, as that is the only subset used by Makhmudov et al. to achieve their 99.13% accuracy.

### 1. Data Loading & Concatenation (Shard's Focus)
```python
def load_network_traffic_data(base_dir: str) -> pd.DataFrame:
    """
    Loads all 59 CSVs from EVSE-A and EVSE-B Network Traffic directories.
    Concatenates them into a single massive DataFrame (~2.74M rows).
    """
    pass
```

### 2. Feature Reduction & Cleaning (Shard's Focus)
Based strictly on `docs/dataset_feature_engineering.md`, we will drop exactly 20 columns to prevent overfitting and remove sparsity:

```python
def clean_and_reduce_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Drops exactly 20 columns as identified in Makhmudov et al.:
    - Identifiers: 'id', 'expiration_id'
    - Network Addresses: 'src_ip', 'src_mac', 'src_oui', 'dst_ip', 'dst_mac', 'dst_oui'
    - Zero Variance: 'vlan_id', 'tunnel_id'
    - String Metadata: 'requested_server_name', 'client_fingerprint', 'server_fingerprint', 'user_agent', 'content_type'
    - App Layer DPI: 'application_name', 'application_category_name', 'application_is_guessed', 'application_confidence'
    - Target: 'Label' (Separated into y)
    
    Also drops all duplicate rows (which accounts for ~1.46M rows).
    """
    pass
```

### 3. Feature Engineering & Splitting (Shruti's Focus)
We will map the targets and scale the remaining ~65 numerical features.

```python
def engineer_features(df: pd.DataFrame) -> tuple:
    """
    1. Extracts the target label. For binary classification, maps normal traffic to 0 
       and all 14 attack classes to 1.
    2. Applies StandardScaler to the remaining ~65 numerical features so they 
       have zero mean and unit variance.
    Returns X (scaled features) and y (encoded labels).
    """
    pass

def split_and_export_data(X, y, output_dir: str):
    """
    Splits the cleaned, scaled data into 70/15/15:
    - Train: 70%
    - Validation: 15%
    - Test: 15%
    Saves the resulting 6 DataFrames to data/processed/ as CSVs.
    """
    pass
```

### 4. Pipeline Orchestrator
```python
def main():
    """
    Executes the pipeline sequentially:
    1. df = load_network_traffic_data(...)
    2. df = clean_and_reduce_features(df)
    3. X, y = engineer_features(df)
    4. split_and_export_data(X, y, ...)
    """
    pass
```

## Verification Plan

### Automated Verification
- We will run `python src/data_prep/preprocess.py` locally.
- We will verify that 6 files are generated successfully in `data/processed/`:
  - `X_train.csv`, `y_train.csv` (70%)
  - `X_val.csv`, `y_val.csv` (15%)
  - `X_test.csv`, `y_test.csv` (15%)

### Manual Verification
- Verify that `src_ip` and `dst_ip` do not exist in the processed outputs.
- Verify all features in `X_train` are float/int types (scaled) and no strings remain.
- Verify that the shape of the features is `N rows x ~65 columns`.
