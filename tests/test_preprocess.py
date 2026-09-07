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
    ABSOLUTE_TIMESTAMP_COLUMNS,
    DROP_COLUMNS,
    EXPECTED_CLASSES,
    LABEL_MAPPING,
    METADATA_COLUMNS,
    _derive_state,
    _normalise_label,
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


def get_leaky_raw_dataframe():
    """Sample frame carrying the absolute capture timestamps from issue #46."""
    df = get_sample_raw_dataframe()
    base = 1_700_000_000_000
    for i, col in enumerate(ABSOLUTE_TIMESTAMP_COLUMNS):
        df[col] = [base + i * 1000 + row * 7 for row in range(len(df))]
    return df


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
    X_numeric, y_encoded, _meta = engineer_features(cleaned_df)

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
    X_numeric, y_encoded, _meta = engineer_features(cleaned_df)

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
    X_scaled, y_encoded, meta = engineer_features(cleaned_df)

    if tmp_path is not None:
        output_dir = os.path.join(tmp_path, "processed")
    else:
        temp_dir_obj = tempfile.TemporaryDirectory()
        output_dir = temp_dir_obj.name

    split_and_export_data(X_scaled, y_encoded, meta, output_dir=output_dir)

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

    X_scaled, y_encoded, meta = engineer_features(cleaned)
    assert X_scaled.empty
    assert y_encoded.empty

    with tempfile.TemporaryDirectory() as tmp_dir:
        split_and_export_data(X_scaled, y_encoded, meta, output_dir=tmp_dir)


# ---------------------------------------------------------------------------
# Issue #46 -- absolute capture timestamps must never reach the feature matrix
# ---------------------------------------------------------------------------

def test_absolute_timestamps_are_dropped():
    """The six *_seen_ms columns encode the capture session and must be removed."""
    cleaned = clean_and_reduce_features(get_leaky_raw_dataframe())
    for col in ABSOLUTE_TIMESTAMP_COLUMNS:
        assert col not in cleaned.columns, f"{col} survived cleaning (issue #46)"


def test_relative_timing_features_are_retained():
    """Durations and inter-arrival times are behavioural and must survive."""
    cleaned = clean_and_reduce_features(get_leaky_raw_dataframe())
    assert "bidirectional_duration_ms" in cleaned.columns


def test_engineer_features_rejects_leaked_timestamps():
    """A timestamp reaching engineer_features is a hard failure, not a warning."""
    df = get_sample_raw_dataframe()
    df["bidirectional_first_seen_ms"] = 1_700_000_000_000
    try:
        engineer_features(df)
        assert False, "Should have raised RuntimeError for leaked timestamp"
    except RuntimeError as e:
        assert "bidirectional_first_seen_ms" in str(e)


def test_drop_columns_includes_timestamps():
    """The exported DROP_COLUMNS constant must cover the leaking columns."""
    for col in ABSOLUTE_TIMESTAMP_COLUMNS:
        assert col in DROP_COLUMNS


# ---------------------------------------------------------------------------
# Issue #49 -- filename-derived labelling
# ---------------------------------------------------------------------------

def test_label_mapping_yields_fifteen_classes():
    """The 19 filename aliases must collapse to exactly the 15 paper classes."""
    assert len(EXPECTED_CLASSES) == 15, f"Expected 15 classes, got {len(EXPECTED_CLASSES)}"
    assert "Benign" in EXPECTED_CLASSES
    assert EXPECTED_CLASSES == sorted(set(LABEL_MAPPING.values()))


def test_normalise_label_from_capture_filenames():
    """Real capture filenames from both EVSEs must resolve to canonical classes."""
    cases = {
        "EVSE-A-Charging-Benign": "Benign",
        "EVSE-A-idle-benign": "Benign",
        "EVSE-A-charging-portscan": "TCP_Port_Scan",
        "EVSE-B-charging-port-scan": "TCP_Port_Scan",
        "EVSE-B-idle-syn-stealth-scan": "SYN_Stealth_Scan",
        "EVSE-A-charging-syn-stealth": "SYN_Stealth_Scan",
        "EVSE-B-MaliciousEV-service-detection": "Service_Version_Detection",
        "EVSE-B-charging-service-detection-scan": "Service_Version_Detection",
        "EVSE-A-charging-synonymous-ip": "SynonymousIP_Flood",
        "EVSE-B-idle-synonymous-ip-flood": "SynonymousIP_Flood",
        "EVSE-B-charging-push-ack-flood": "PSHACK_Flood",
    }
    for stem, expected in cases.items():
        assert _normalise_label(stem) == expected, f"{stem} -> {_normalise_label(stem)}, want {expected}"


def test_every_resolved_label_is_a_known_class():
    """No capture filename may resolve to something outside the 15-class taxonomy."""
    stems = [
        "EVSE-A-Charging-Benign", "EVSE-A-idle-aggressive-scan",
        "EVSE-B-idle-icmp-flood", "EVSE-B-charging-icmp-fragmentation",
        "EVSE-B-MaliciousEV-os-fingerprinting", "EVSE-A-idle-slowloris-scan",
        "EVSE-B-idle-tcp-flood", "EVSE-A-charging-udp-flood",
        "EVSE-B-charging-vulnerability-scan", "EVSE-A-idle-syn-flood",
    ]
    for stem in stems:
        assert _normalise_label(stem) in EXPECTED_CLASSES, f"{stem} resolved outside the taxonomy"


def test_derive_state_from_filename():
    """EVSE operating state is recoverable for the provenance metadata."""
    assert _derive_state("EVSE-A-Charging-Benign") == "charging"
    assert _derive_state("EVSE-A-idle-benign") == "idle"
    assert _derive_state("EVSE-B-MaliciousEV-port-scan") == "maliciousev"


# ---------------------------------------------------------------------------
# Issue #48 -- deduplication runs after the column drops
# ---------------------------------------------------------------------------

def test_deduplication_runs_after_column_drops():
    """
    Two rows differing only in dropped columns must collapse into one.

    Under the old ordering they stayed distinct, which is why the step removed
    29 rows out of 2.74M instead of the reference's 53.5%.
    """
    df = pd.DataFrame({
        "id": [1, 2],
        "src_ip": ["10.0.0.1", "10.0.0.2"],          # dropped -> not distinguishing
        "src_port": [40001, 40002],                   # kept by 'extended'
        "bidirectional_first_seen_ms": [1_700_000_000_000, 1_700_000_000_500],  # dropped (#46)
        "bidirectional_packets": [1, 1],
        "bidirectional_bytes": [54, 54],
        "Label": ["SYN_Flood", "SYN_Flood"],
    })
    # 'reference' also drops the ports, leaving the two rows identical.
    assert len(clean_and_reduce_features(df, feature_set="reference")) == 1
    # 'extended' keeps ports, so they remain genuinely distinct flows.
    assert len(clean_and_reduce_features(df, feature_set="extended")) == 2


def test_dedup_scope_controls_cross_capture_collapse():
    """
    Global dedup absorbs an identical flow from one capture into another,
    destroying provenance; per-capture dedup keeps both. Observed on the real
    data as EVSE-B-idle-icmp-flood.csv vanishing into the charging capture.
    """
    shared = {
        "bidirectional_packets": 1, "bidirectional_bytes": 54,
        "bidirectional_duration_ms": 0.0, "Label": "ICMP_Flood",
        "evse": "EVSE-B", "state": "idle", "capture_timestamp_ms": 1_700_000_000_000,
    }
    df = pd.DataFrame([
        {**shared, "source_file": "EVSE-B-charging-icmp-flood.csv"},
        {**shared, "source_file": "EVSE-B-idle-icmp-flood.csv"},
    ])

    collapsed = clean_and_reduce_features(df, dedup="global")
    assert len(collapsed) == 1
    assert collapsed["source_file"].nunique() == 1, "one capture should have been absorbed"

    preserved = clean_and_reduce_features(df, dedup="per-capture")
    assert len(preserved) == 2
    assert preserved["source_file"].nunique() == 2, "provenance must survive per-capture dedup"

    assert len(clean_and_reduce_features(df, dedup="none")) == 2


def test_invalid_dedup_scope_raises():
    try:
        clean_and_reduce_features(get_sample_raw_dataframe(), dedup="sometimes")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "dedup" in str(e)


# ---------------------------------------------------------------------------
# Issue #50 -- provenance metadata and split strategies
# ---------------------------------------------------------------------------

def _provenance_frame(n_per_file=40):
    """
    Three captures per class across two EVSEs, mirroring the real dataset's
    structure closely enough that a three-way grouped split is meaningful.
    """
    rows = []
    files = []
    for label, prefix in [("SYN_Flood", "syn-flood"), ("TCP_Port_Scan", "port-scan"),
                          ("UDP_Flood", "udp-flood")]:
        files += [
            (f"EVSE-A-charging-{prefix}.csv", "EVSE-A", "charging", label),
            (f"EVSE-B-idle-{prefix}.csv", "EVSE-B", "idle", label),
            (f"EVSE-B-charging-{prefix}.csv", "EVSE-B", "charging", label),
        ]
    stamp = 1_700_000_000_000
    for f_idx, (fname, evse, state, label) in enumerate(files):
        for i in range(n_per_file):
            rows.append({
                "bidirectional_packets": i + f_idx,
                "bidirectional_bytes": 54 * (i + 1) + f_idx,
                "bidirectional_duration_ms": float(i),
                "Label": label,
                "source_file": fname,
                "evse": evse,
                "state": state,
                "capture_timestamp_ms": stamp + f_idx * 1_000_000 + i,
            })
    return pd.DataFrame(rows)


def test_metadata_is_separated_from_features():
    """Provenance must land in meta, never in X."""
    cleaned = clean_and_reduce_features(_provenance_frame())
    X, y, meta = engineer_features(cleaned)
    for col in METADATA_COLUMNS:
        assert col not in X.columns, f"{col} leaked into the feature matrix"
        assert col in meta.columns, f"{col} missing from the metadata frame"
    assert len(meta) == len(X)


def test_grouped_split_holds_out_whole_captures():
    """No source_file may appear in more than one partition."""
    cleaned = clean_and_reduce_features(_provenance_frame())
    X, y, meta = engineer_features(cleaned)

    with tempfile.TemporaryDirectory() as tmp_dir:
        split_and_export_data(X, y, meta, output_dir=tmp_dir, strategy="grouped")
        partitions = {
            name: set(pd.read_csv(os.path.join(tmp_dir, f"meta_{name}.csv"))["source_file"])
            for name in ("train", "val", "test")
        }

    assert not partitions["train"] & partitions["test"], "a capture spans train and test"
    assert not partitions["train"] & partitions["val"], "a capture spans train and val"
    assert not partitions["val"] & partitions["test"], "a capture spans val and test"


def test_grouped_split_keeps_every_class_in_every_partition():
    """
    A plain GroupShuffleSplit drops nine of the fifteen classes from val and
    test on the real dataset. The class-aware allocation must not.
    """
    cleaned = clean_and_reduce_features(_provenance_frame())
    X, y, meta = engineer_features(cleaned)
    all_classes = set(y["Label_Multiclass"])

    with tempfile.TemporaryDirectory() as tmp_dir:
        split_and_export_data(X, y, meta, output_dir=tmp_dir, strategy="grouped")
        for name in ("train", "val", "test"):
            present = set(pd.read_csv(os.path.join(tmp_dir, f"y_{name}.csv"))["Label_Multiclass"])
            assert present == all_classes, f"{name} is missing {sorted(all_classes - present)}"


def test_temporal_split_is_ordered_in_time():
    """Every training row must precede every test row in capture time."""
    cleaned = clean_and_reduce_features(_provenance_frame())
    X, y, meta = engineer_features(cleaned)

    with tempfile.TemporaryDirectory() as tmp_dir:
        split_and_export_data(X, y, meta, output_dir=tmp_dir, strategy="temporal")
        stamps = {
            name: pd.read_csv(os.path.join(tmp_dir, f"meta_{name}.csv"))["capture_timestamp_ms"]
            for name in ("train", "val", "test")
        }

    assert stamps["train"].max() <= stamps["val"].min()
    assert stamps["val"].max() <= stamps["test"].min()


def test_metadata_files_are_exported():
    """meta_*.csv must accompany every partition when provenance is present."""
    cleaned = clean_and_reduce_features(_provenance_frame())
    X, y, meta = engineer_features(cleaned)

    with tempfile.TemporaryDirectory() as tmp_dir:
        split_and_export_data(X, y, meta, output_dir=tmp_dir, strategy="random")
        for name in ("train", "val", "test"):
            path = os.path.join(tmp_dir, f"meta_{name}.csv")
            assert os.path.exists(path), f"missing {path}"
            assert list(pd.read_csv(path).columns) == METADATA_COLUMNS


# ---------------------------------------------------------------------------
# Issue #51 -- feature-set selection
# ---------------------------------------------------------------------------

def test_reference_feature_set_drops_ports():
    """The reference notebook drops both ports (cell 19); 'extended' keeps them."""
    df = get_leaky_raw_dataframe()
    df["src_port"] = range(len(df))
    df["dst_port"] = [80] * len(df)

    reference = clean_and_reduce_features(df, feature_set="reference")
    extended = clean_and_reduce_features(df, feature_set="extended")

    assert "src_port" not in reference.columns
    assert "dst_port" not in reference.columns
    assert "dst_port" in extended.columns


def test_invalid_feature_set_raises():
    try:
        clean_and_reduce_features(get_sample_raw_dataframe(), feature_set="nonsense")
        assert False, "Should have raised ValueError"
    except ValueError as e:
        assert "feature_set" in str(e)


if __name__ == "__main__":
    import traceback
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_") and callable(v)]
    failed = 0
    for fn in tests:
        try:
            fn()
            print(f"PASSED  {fn.__name__}")
        except Exception:
            failed += 1
            print(f"FAILED  {fn.__name__}")
            traceback.print_exc()
    print(f"\n{len(tests) - failed}/{len(tests)} preprocessing tests passed.")
