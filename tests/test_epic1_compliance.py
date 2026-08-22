import os
import pytest
import pandas as pd
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
DATA_DIR = PROJECT_ROOT / "data" / "processed"
MODELS_DIR = PROJECT_ROOT / "saved_models"

@pytest.mark.skipif(os.environ.get("GITHUB_ACTIONS") == "true", reason="Processed data is gitignored")
def test_processed_data_files_exist():
    """Rule: Epic 1 requires X_train.csv, y_train.csv, X_test.csv, y_test.csv."""
    assert (DATA_DIR / "X_train.csv").exists(), "X_train.csv is missing!"
    assert (DATA_DIR / "y_train.csv").exists(), "y_train.csv is missing!"
    assert (DATA_DIR / "X_test.csv").exists(), "X_test.csv is missing!"
    assert (DATA_DIR / "y_test.csv").exists(), "y_test.csv is missing!"

@pytest.mark.skipif(os.environ.get("GITHUB_ACTIONS") == "true", reason="Processed data is gitignored")
def test_labels_are_only_multiclass():
    """Rule: Epic 1 drops binary labels. Only Label_Multiclass should exist."""
    y_train_path = DATA_DIR / "y_train.csv"
    if y_train_path.exists():
        y_train = pd.read_csv(y_train_path, nrows=5)
        assert "Label" not in y_train.columns, "Binary 'Label' column should be dropped!"
        assert "Label_Multiclass" in y_train.columns, "Label_Multiclass column is missing!"

def test_scaler_exists():
    """Rule: StandardScaler must be saved."""
    assert (MODELS_DIR / "StandardScaler.pkl").exists(), "StandardScaler.pkl is missing!"
