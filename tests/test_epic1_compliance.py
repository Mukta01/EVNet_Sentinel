import os
import sys
import pytest
import pandas as pd
from pathlib import Path

# Paths
PROJECT_ROOT = Path(__file__).parent.parent
sys.path.insert(0, str(PROJECT_ROOT))
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

def test_scaler_is_saved_beside_its_dataset():
    """
    Rule: the pipeline must persist the StandardScaler it fitted.

    It is written beside the dataset it was fitted on rather than into
    saved_models/, so a re-run cannot silently invalidate models trained against
    an earlier version (issue #55). Model artifacts are no longer committed --
    src/api/main.py loads every .pkl in saved_models/ into its serving registry,
    so a stale committed model gets served as though it were current. Pass
    --publish-scaler to also copy it there for the API.
    """
    import tempfile

    import numpy as np
    import pandas as pd

    from src.data_prep.preprocess import engineer_features, split_and_export_data

    frame = pd.DataFrame({
        "bidirectional_packets": np.arange(40),
        "bidirectional_bytes": np.arange(40) * 54.0,
        "Label": ["SYN_Flood", "TCP_Port_Scan"] * 20,
    })
    X, y, meta = engineer_features(frame)

    with tempfile.TemporaryDirectory() as data_dir, tempfile.TemporaryDirectory() as publish_dir:
        published = os.path.join(publish_dir, "StandardScaler.pkl")
        split_and_export_data(X, y, meta, output_dir=data_dir, scaler_path=published)

        assert os.path.exists(os.path.join(data_dir, "StandardScaler.pkl")), \
            "scaler must be written beside its dataset"
        assert os.path.exists(published), "--publish-scaler must copy the scaler for the API"


def test_scaler_not_written_when_scaling_disabled():
    """`--scale none` serves the streaming models, which scale internally (#52)."""
    import tempfile

    import numpy as np
    import pandas as pd

    from src.data_prep.preprocess import engineer_features, split_and_export_data

    frame = pd.DataFrame({
        "bidirectional_packets": np.arange(40),
        "bidirectional_bytes": np.arange(40) * 54.0,
        "Label": ["SYN_Flood", "TCP_Port_Scan"] * 20,
    })
    X, y, meta = engineer_features(frame)

    with tempfile.TemporaryDirectory() as data_dir:
        split_and_export_data(X, y, meta, output_dir=data_dir, scale="none")
        assert not os.path.exists(os.path.join(data_dir, "StandardScaler.pkl"))
        assert os.path.exists(os.path.join(data_dir, "X_train.csv"))
