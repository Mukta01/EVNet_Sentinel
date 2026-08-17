"""
Unit tests for EVNet Sentinel Data Preprocessing Pipeline (src/data_prep/preprocess.py).
"""

import os
import sys
import tempfile
import numpy as np
import pandas as pd
try:
    import pytest
except ImportError:
    pytest = None

# Ensure root workspace directory is in sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.data_prep.preprocess import (
    DROP_COLUMNS,
    clean_and_reduce_features,
    engineer_features,
    split_and_export_data,
    load_network_traffic_data,
)


def get_sample_raw_dataframe():
    """
    Creates a synthetic raw DataFrame matching CICEVSE2024 schema.
    """
    data = {
        "id": [1, 2, 3, 4, 4, 5, 6, 7, 8, 9, 10],
        "expiration_id": [0] * 11,
        "src_ip": ["192.168.1.1"] * 11,
        "dst_ip": ["192.168.1.2"] * 11,
        "src_mac": ["00:11:22:33:44:55"] * 11,
        "vlan_id": [0] * 11,
        "application_name": ["HTTP"] * 11,
        "bidirectional_packets": [10, 20, 30, 40, 40, 50, 60, 70, 80, 90, 100],
        "bidirectional_bytes": [100, 200, 300, 400, 400, 500, 600, 700, 800, 900, 1000],
        "bidirectional_duration_ms": [1.0, 2.0, 3.0, 4.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0],
        "Label": [
            "Benign", "benign", "SYN Flood", "Slowloris", "Slowloris",
            "TCP Port Scan", "Backdoor", "Cryptojacking", "Benign", "UDP Flood", "Benign"
        ],
    }
    return pd.DataFrame(data)


if pytest is not None:
    @pytest.fixture
    def sample_raw_dataframe():
        return get_sample_raw_dataframe()


def test_clean_and_reduce_features(sample_raw_dataframe=None):
    """
    Verifies that dropped columns and duplicate rows are correctly removed.
    """
    if sample_raw_dataframe is None:
        sample_raw_dataframe = get_sample_raw_dataframe()

    cleaned_df = clean_and_reduce_features(sample_raw_dataframe)
    
    # Check duplicate removal (row #4 is duplicate)
    assert len(cleaned_df) == 10
    
    # Check dropped columns
    for col in ["id", "src_ip", "dst_ip", "vlan_id", "application_name"]:
        assert col not in cleaned_df.columns
        
    # Check kept columns
    assert "bidirectional_packets" in cleaned_df.columns
    assert "bidirectional_bytes" in cleaned_df.columns
    assert "Label" in cleaned_df.columns


def test_engineer_features_target_encoding(sample_raw_dataframe=None):
    """
    Verifies binary and multiclass label encoding: Benign -> 0, Attack -> 1.
    """
    if sample_raw_dataframe is None:
        sample_raw_dataframe = get_sample_raw_dataframe()

    cleaned_df = clean_and_reduce_features(sample_raw_dataframe)
    X_numeric, y_encoded = engineer_features(cleaned_df)

    assert isinstance(y_encoded, pd.DataFrame)
    assert "Label_Binary" in y_encoded.columns
    assert "Label_Multiclass" in y_encoded.columns
    
    expected_binary_labels = [0, 0, 1, 1, 1, 1, 1, 0, 1, 0]
    assert list(y_encoded["Label_Binary"].values) == expected_binary_labels


def test_engineer_features_extraction(sample_raw_dataframe=None):
    """
    Verifies that numerical features are extracted into a DataFrame.
    """
    if sample_raw_dataframe is None:
        sample_raw_dataframe = get_sample_raw_dataframe()

    cleaned_df = clean_and_reduce_features(sample_raw_dataframe)
    X_numeric, y_encoded = engineer_features(cleaned_df)

    assert isinstance(X_numeric, pd.DataFrame)
    assert not X_numeric.empty
    assert "bidirectional_packets" in X_numeric.columns
    assert "bidirectional_bytes" in X_numeric.columns


def test_split_and_export_data(sample_raw_dataframe=None, tmp_path=None):
    """
    Verifies 70/15/15 dataset splitting and CSV exports.
    """
    if sample_raw_dataframe is None:
        sample_raw_dataframe = get_sample_raw_dataframe()

    cleaned_df = clean_and_reduce_features(sample_raw_dataframe)
    X_scaled, y_encoded = engineer_features(cleaned_df)

    if tmp_path is not None:
        output_dir = os.path.join(tmp_path, "processed")
    else:
        temp_dir_obj = tempfile.TemporaryDirectory()
        output_dir = temp_dir_obj.name

    split_and_export_data(X_scaled, y_encoded, output_dir=output_dir)

    expected_files = [
        "X_train.csv", "y_train.csv",
        "X_val.csv", "y_val.csv",
        "X_test.csv", "y_test.csv"
    ]

    for fname in expected_files:
        fpath = os.path.join(output_dir, fname)
        assert os.path.exists(fpath)
        df_exported = pd.read_csv(fpath)
        assert not df_exported.empty

    X_train = pd.read_csv(os.path.join(output_dir, "X_train.csv"))
    X_val = pd.read_csv(os.path.join(output_dir, "X_val.csv"))
    X_test = pd.read_csv(os.path.join(output_dir, "X_test.csv"))

    total_exported = len(X_train) + len(X_val) + len(X_test)
    assert total_exported == len(X_scaled)
    assert len(X_train) == 7
    assert len(X_val) in (1, 2)
    assert len(X_test) in (1, 2)


def test_engineer_features_missing_label_raises():
    """
    Verifies that missing 'Label' column raises KeyError.
    """
    df_no_label = pd.DataFrame({"feat1": [1, 2, 3], "feat2": [4, 5, 6]})
    try:
        engineer_features(df_no_label)
        assert False, "Should have raised KeyError"
    except KeyError as e:
        assert "Label" in str(e)


def test_empty_dataframe_graceful_handling():
    """
    Verifies graceful handling of empty DataFrames.
    """
    empty_df = pd.DataFrame()
    
    cleaned = clean_and_reduce_features(empty_df)
    assert cleaned.empty

    X_scaled, y_encoded = engineer_features(cleaned)
    assert X_scaled.empty
    assert y_encoded.empty

    with tempfile.TemporaryDirectory() as tmp_dir:
        split_and_export_data(X_scaled, y_encoded, output_dir=tmp_dir)


if __name__ == "__main__":
    print("Running test_clean_and_reduce_features...")
    test_clean_and_reduce_features()
    print("PASSED")

    print("Running test_engineer_features_target_encoding...")
    test_engineer_features_target_encoding()
    print("PASSED")

    print("Running test_engineer_features_extraction...")
    test_engineer_features_extraction()
    print("PASSED")

    print("Running test_split_and_export_data...")
    test_split_and_export_data()
    print("PASSED")

    print("Running test_engineer_features_missing_label_raises...")
    test_engineer_features_missing_label_raises()
    print("PASSED")

    print("Running test_empty_dataframe_graceful_handling...")
    test_empty_dataframe_graceful_handling()
    print("PASSED")

    print("\nALL 6 PREPROCESSING UNIT TESTS PASSED SUCCESSFULLY!")
