"""
Centralized Data Preprocessing Script for EVNet Sentinel.

Reproduces the data preprocessing pipeline from Makhmudov et al. (2025) for the
CICEVSE2024 Network Traffic dataset, with corrections for defects found while
auditing the reference implementation. See issue #56 for the full audit.

Corrections applied here
------------------------
#49  The 'Label' column is derived from the capture filename inside this script.
     Previously it arrived pre-computed in a private archive, which meant the
     repository could not rebuild the dataset from the public CIC download.

#46  The six absolute epoch-millisecond columns are dropped. Each attack was
     captured in its own pcap at its own wall-clock time, so those columns act
     as a capture-session ID rather than as traffic behaviour: a decision tree
     on `bidirectional_first_seen_ms` alone scores 1.0000 on the 15-class
     target. Relative timing (`*_duration_ms`, `*_piat_ms`) is behavioural and
     is deliberately retained.

#48  Deduplication now runs *after* the column drops. While rows still carry
     ports and millisecond timestamps almost every row is unique, so the old
     ordering removed 29 rows out of 2,744,700. The reference dedups last and
     removes 53.5%, which is what produces the paper's ~1.2M row count.

#50  Capture provenance (source file, EVSE, state, capture timestamp) is carried
     through as metadata and exported separately from X, so it can drive grouped
     and temporal splits without ever entering the feature matrix.

#51  Two feature sets are selectable. 'reference' matches the upstream notebook
     (drops ports, applies the >80%-zeros rule); 'extended' is our variant which
     retains ports. Both drop the leaking timestamps.
"""

import argparse
import glob
import logging
import os
import pickle
from typing import Dict, List, Tuple

import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s"
)
logger = logging.getLogger(__name__)

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

# --------------------------------------------------------------------------
# Labelling (#49) -- ported from Preprocessing_CICEVSE2024_NT.ipynb cells 1-8
# --------------------------------------------------------------------------

# Scenario prefixes stripped from the capture filename before the alias lookup.
FILENAME_PREFIXES = [
    "evse-b-maliciousev-",
    "evse-a-charging-",
    "evse-a-idle-",
    "evse-b-charging-",
    "evse-b-idle-",
]

# 19 filename aliases collapse to 15 classes. EVSE-A and EVSE-B name the same
# attack differently ("portscan" vs "port-scan", "syn-stealth" vs
# "syn-stealth-scan"), so this map is load-bearing rather than cosmetic. Class
# names follow the reference implementation so our results tabulate directly
# against the paper's Tables 8 and 9.
LABEL_MAPPING: Dict[str, str] = {
    "aggressive-scan": "Aggressive_Scan",
    "benign": "Benign",
    "icmp-flood": "ICMP_Flood",
    "icmp-fragmentation": "ICMP_Fragmentation",
    "os-fingerprinting": "OS_Fingerprinting",
    "portscan": "TCP_Port_Scan",
    "push-ack-flood": "PSHACK_Flood",
    "service-detection": "Service_Version_Detection",
    "slowloris-scan": "Slowloris_Scan",
    "syn-flood": "SYN_Flood",
    "syn-stealth": "SYN_Stealth_Scan",
    "synonymous-ip": "SynonymousIP_Flood",
    "tcp-flood": "TCP_Flood",
    "udp-flood": "UDP_Flood",
    "vulnerability-scan": "Vulnerability_Scan",
    "syn-stealth-scan": "SYN_Stealth_Scan",
    "port-scan": "TCP_Port_Scan",
    "service-detection-scan": "Service_Version_Detection",
    "synonymous-ip-flood": "SynonymousIP_Flood",
}

EXPECTED_CLASSES = sorted(set(LABEL_MAPPING.values()))  # 15 classes

BENIGN_CLASS = "Benign"

# --------------------------------------------------------------------------
# Column groups
# --------------------------------------------------------------------------

# #46: absolute wall-clock positions. These identify the capture session, not
# the traffic. Never features; `capture_timestamp_ms` keeps one of them as
# metadata so the temporal split can order the stream.
ABSOLUTE_TIMESTAMP_COLUMNS = [
    "bidirectional_first_seen_ms",
    "bidirectional_last_seen_ms",
    "src2dst_first_seen_ms",
    "src2dst_last_seen_ms",
    "dst2src_first_seen_ms",
    "dst2src_last_seen_ms",
]

# #50: provenance carried alongside X, exported to meta_*.csv, never modelled.
METADATA_COLUMNS = ["source_file", "evse", "state", "capture_timestamp_ms"]

# Sparse HTTP/TLS metadata -- empty for OCPP and ISO 15118 traffic.
SPARSE_METADATA_COLUMNS = [
    "requested_server_name",
    "client_fingerprint",
    "server_fingerprint",
    "user_agent",
    "content_type",
]

# Environment-specific identifiers. Dropped by both feature sets.
IDENTIFIER_COLUMNS = [
    "id",
    "expiration_id",
    "src_ip", "src_mac", "src_oui",
    "dst_ip", "dst_mac", "dst_oui",
]

# #51: the reference additionally drops both ports (notebook cell 19). Our
# 'extended' set keeps them -- destination port is genuine attack signal for
# port scans and service detection -- but the deviation is now explicit.
PORT_COLUMNS = ["src_port", "dst_port"]

# NFStream DPI output. The reference drops the first two by name and lets the
# >80%-zeros rule catch the rest; 'extended' drops all four.
APPLICATION_COLUMNS_REFERENCE = ["application_name", "application_category_name"]
APPLICATION_COLUMNS_EXTENDED = APPLICATION_COLUMNS_REFERENCE + [
    "application_is_guessed",
    "application_confidence",
]

# Constant in the testbed; kept for the 'extended' set which does not run the
# statistical zero-fraction rule.
NEAR_ZERO_VARIANCE_COLUMNS = ["vlan_id", "tunnel_id"]

ZERO_FRACTION_THRESHOLD = 80.0  # reference notebook cell 10

# Retained for backward compatibility with tests and callers that import it.
DROP_COLUMNS = (
    IDENTIFIER_COLUMNS
    + NEAR_ZERO_VARIANCE_COLUMNS
    + SPARSE_METADATA_COLUMNS
    + APPLICATION_COLUMNS_EXTENDED
    + ABSOLUTE_TIMESTAMP_COLUMNS
)


def _normalise_label(filename_stem: str) -> str:
    """Map a capture filename stem to its canonical class name (#49)."""
    label = filename_stem.lower()
    for prefix in FILENAME_PREFIXES:
        label = label.replace(prefix, "")
    return LABEL_MAPPING.get(label, label)


def _derive_state(filename_stem: str) -> str:
    """Extract the EVSE operating state encoded in the filename (#50)."""
    stem = filename_stem.lower()
    if "maliciousev" in stem:
        return "maliciousev"
    if "charging" in stem:
        return "charging"
    if "idle" in stem:
        return "idle"
    return "unknown"


def load_network_traffic_data(base_dir: str = "data/raw") -> pd.DataFrame:
    """
    Find every Network Traffic capture CSV under base_dir, label each row from
    its filename, and concatenate.

    The search is recursive so this works against both the extracted archive in
    `data/raw/` and the in-repo `datasets/CICEVSE2024_Dataset/` layout.
    """
    logger.info("Scanning for capture CSVs under '%s'...", base_dir)

    if not os.path.exists(base_dir):
        logger.warning("Directory '%s' does not exist. Returning empty DataFrame.", base_dir)
        return pd.DataFrame()

    csv_files = sorted(
        glob.glob(os.path.join(base_dir, "**", "Network Traffic", "**", "*.csv"), recursive=True)
    )
    # Fall back to a plain recursive sweep if the archive nests differently.
    if not csv_files:
        csv_files = sorted(glob.glob(os.path.join(base_dir, "**", "*.csv"), recursive=True))

    csv_files = [f for f in csv_files if os.path.basename(f).lower().startswith("evse-")]

    if not csv_files:
        logger.warning("No capture CSVs found under '%s'. Returning empty DataFrame.", base_dir)
        return pd.DataFrame()

    logger.info("Found %d capture file(s). Loading and labelling...", len(csv_files))

    frames: List[pd.DataFrame] = []
    for file_path in csv_files:
        basename = os.path.basename(file_path)
        stem = os.path.splitext(basename)[0]
        try:
            frame = pd.read_csv(file_path, low_memory=False)
        except Exception as exc:
            logger.error("Failed to read '%s': %s", file_path, exc)
            continue

        # #49: the label is the capture filename.
        frame["Label"] = _normalise_label(stem)
        # #50: provenance for grouped / temporal splits.
        frame["source_file"] = basename
        frame["evse"] = "EVSE-A" if "evse-a" in stem.lower() else "EVSE-B"
        frame["state"] = _derive_state(stem)
        frame["capture_timestamp_ms"] = frame.get("bidirectional_first_seen_ms", pd.Series(0, index=frame.index))
        frames.append(frame)

    if not frames:
        return pd.DataFrame()

    combined = pd.concat(frames, ignore_index=True)
    logger.info("Loaded combined dataset with shape %s.", combined.shape)

    observed = sorted(combined["Label"].unique())
    unmapped = [c for c in observed if c not in EXPECTED_CLASSES]
    if unmapped:
        logger.warning("Filenames that did not resolve to a known class: %s", unmapped)
    logger.info("Resolved %d classes: %s", len(observed), observed)

    return combined


def clean_and_reduce_features(df: pd.DataFrame, feature_set: str = "extended",
                              dedup: str = "global") -> pd.DataFrame:
    """
    Drop non-predictive and leaking columns, then remove duplicate rows.

    Order matters (#48): dropping first lets structurally identical flows -- the
    thousands of single-packet flows a flood emits -- collapse into genuine
    duplicates. Deduplicating first, as the previous implementation did, removes
    almost nothing because ports and timestamps make every row unique.

    `dedup` controls the scope:

      global       Match the reference: a duplicate is removed no matter which
                   capture it came from. This is what produces the paper's row
                   count, but it destroys provenance -- the surviving row keeps
                   whichever `source_file` appeared first, so an entire capture
                   can be absorbed into another. Observed on the real data:
                   EVSE-B-idle-icmp-flood.csv vanishes entirely into
                   EVSE-B-charging-icmp-flood.csv.
      per-capture  Deduplicate within each capture only. Provenance stays
                   intact, so grouped and temporal splits (#50) mean what they
                   claim. Prefer this whenever `--split grouped` is used.
      none         Keep every row.
    """
    if df.empty:
        logger.warning("Empty DataFrame passed to clean_and_reduce_features.")
        return df.copy()

    if feature_set not in ("reference", "extended"):
        raise ValueError(f"feature_set must be 'reference' or 'extended', got {feature_set!r}")
    if dedup not in ("global", "per-capture", "none"):
        raise ValueError(f"dedup must be 'global', 'per-capture' or 'none', got {dedup!r}")

    working = df.copy()
    initial_shape = working.shape
    logger.info("Cleaning DataFrame with shape %s using the '%s' feature set.", initial_shape, feature_set)

    protected = [c for c in METADATA_COLUMNS + ["Label"] if c in working.columns]

    to_drop = list(IDENTIFIER_COLUMNS)
    to_drop += SPARSE_METADATA_COLUMNS
    to_drop += ABSOLUTE_TIMESTAMP_COLUMNS  # #46

    if feature_set == "reference":
        to_drop += PORT_COLUMNS
        to_drop += APPLICATION_COLUMNS_REFERENCE
        # Reference cell 10: statistical zero-fraction rule, computed on
        # candidate features only so metadata and Label cannot be swept up.
        candidates = working.drop(columns=[c for c in protected if c in working.columns])
        zero_fraction = (candidates == 0).mean() * 100
        high_zero = list(zero_fraction[zero_fraction > ZERO_FRACTION_THRESHOLD].index)
        to_drop += high_zero
        logger.info("Zero-fraction rule flagged %d columns with >%.0f%% zeros.",
                    len(high_zero), ZERO_FRACTION_THRESHOLD)
    else:
        to_drop += APPLICATION_COLUMNS_EXTENDED
        to_drop += NEAR_ZERO_VARIANCE_COLUMNS

    existing = [c for c in dict.fromkeys(to_drop) if c in working.columns and c not in protected]
    working.drop(columns=existing, inplace=True)
    logger.info("Dropped %d columns (%d of them leaking timestamps).",
                len(existing), len([c for c in existing if c in ABSOLUTE_TIMESTAMP_COLUMNS]))

    # #48: dedup last, on features + Label, ignoring provenance metadata. Two
    # identical flows carrying different labels are genuinely ambiguous and both
    # are kept, matching the reference's whole-row drop_duplicates().
    if dedup != "none":
        dedup_subset = [c for c in working.columns if c not in METADATA_COLUMNS]
        if dedup == "per-capture" and "source_file" in working.columns:
            dedup_subset.append("source_file")
        before = len(working)
        working = working.drop_duplicates(subset=dedup_subset).reset_index(drop=True)
        removed = before - len(working)
        logger.info("Deduplication (%s) removed %d of %d rows (%.1f%%). Remaining: %d.",
                    dedup, removed, before, 100 * removed / before if before else 0.0, len(working))
    else:
        logger.info("Deduplication skipped. Rows: %d.", len(working))

    numeric_cols = working.select_dtypes(include=[np.number]).columns
    working[numeric_cols] = working[numeric_cols].replace([np.inf, -np.inf], np.nan).fillna(0)

    logger.info("Cleaning complete. Output shape: %s.", working.shape)
    return working


def engineer_features(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.DataFrame, pd.DataFrame]:
    """
    Split the frame into (features, targets, metadata).

    Scaling is deliberately deferred until after the train/val/test split so the
    scaler never sees held-out data.
    """
    if df.empty:
        logger.warning("Empty DataFrame passed to engineer_features.")
        return pd.DataFrame(), pd.DataFrame(), pd.DataFrame()

    if "Label" not in df.columns:
        raise KeyError("Input DataFrame is missing required target column 'Label'.")

    y_raw = df["Label"]

    def canonicalise(value) -> str:
        if pd.isna(value):
            return BENIGN_CLASS
        text = str(value).strip()
        return LABEL_MAPPING.get(text.lower(), text)

    y_multiclass = y_raw.apply(canonicalise)

    def encode_binary(value) -> int:
        if pd.isna(value):
            return 0
        text = str(value).lower().strip()
        return 0 if text in ("benign", "0", "false", "normal") else 1

    y_binary = y_raw.apply(encode_binary).astype(int)

    y_combined = pd.DataFrame({
        "Label_Binary": y_binary.values,
        "Label_Multiclass": y_multiclass.values,
    }, index=df.index)

    meta_cols = [c for c in METADATA_COLUMNS if c in df.columns]
    meta = df[meta_cols].copy() if meta_cols else pd.DataFrame(index=df.index)

    X_raw = df.drop(columns=["Label"] + meta_cols, errors="ignore").copy()
    for col in X_raw.columns:
        X_raw[col] = pd.to_numeric(X_raw[col], errors="coerce")
    X_raw.fillna(0, inplace=True)

    leaked = [c for c in ABSOLUTE_TIMESTAMP_COLUMNS if c in X_raw.columns]
    if leaked:
        raise RuntimeError(
            f"Absolute timestamp columns reached the feature matrix: {leaked}. "
            "These leak the label (issue #46) and must be dropped in cleaning."
        )

    if X_raw.empty:
        logger.warning("No numeric features available.")
        return X_raw, y_combined, meta

    logger.info("Engineered %d features across %d rows.", X_raw.shape[1], X_raw.shape[0])
    logger.info("Targets -> Benign: %d, Attack: %d.", int((y_binary == 0).sum()), int((y_binary == 1).sum()))
    return X_raw, y_combined, meta


def _grouped_class_aware_split(y, meta, random_state: int = 42):
    """
    Hold out whole captures while keeping every class represented (#50).

    A plain GroupShuffleSplit is unusable on CICEVSE2024: there are only 59
    captures across 15 classes (2 to 5 each), so an unconstrained group split
    leaves nine classes absent from both val and test. Instead each class's
    captures are allocated independently, so no capture ever spans a partition
    boundary and every class that *can* appear in a partition does.

    The two-capture classes (Benign, Slowloris_Scan) cannot reach all three
    partitions; they are placed in train and test, and the caller's coverage
    report names them.
    """
    rng = np.random.RandomState(random_state)
    target = y["Label_Multiclass"].values
    files = meta["source_file"].values

    assignment = {}
    for cls in np.unique(target):
        cls_files = sorted({f for f in files[target == cls] if f not in assignment})
        rng.shuffle(cls_files)
        n = len(cls_files)
        if n == 0:
            continue
        if n == 1:
            parts = ["train"]
        elif n == 2:
            parts = ["train", "test"]
        elif n == 3:
            parts = ["train", "val", "test"]
        else:
            n_test = max(1, int(round(0.15 * n)))
            n_val = max(1, int(round(0.15 * n)))
            parts = ["train"] * (n - n_test - n_val) + ["val"] * n_val + ["test"] * n_test
        for name, part in zip(cls_files, parts):
            assignment[name] = part

    partition_of = np.array([assignment.get(f, "train") for f in files])
    return tuple(np.where(partition_of == p)[0] for p in ("train", "val", "test"))


def _split_indices(X, y, meta, strategy: str, random_state: int = 42):
    """Return (train_idx, val_idx, test_idx) positional arrays for the strategy (#50)."""
    positions = np.arange(len(X))

    if strategy == "random":
        target = y["Label_Multiclass"]
        counts = target.value_counts()
        stratify = target if len(counts) > 1 and counts.min() >= 2 else None
        train_idx, temp_idx = train_test_split(
            positions, test_size=0.30, random_state=random_state, stratify=stratify
        )
        temp_target = target.iloc[temp_idx]
        temp_counts = temp_target.value_counts()
        stratify_temp = temp_target if len(temp_counts) > 1 and temp_counts.min() >= 2 else None
        val_idx, test_idx = train_test_split(
            temp_idx, test_size=0.50, random_state=random_state, stratify=stratify_temp
        )
        return train_idx, val_idx, test_idx

    if strategy == "grouped":
        if "source_file" not in meta.columns:
            raise ValueError("Grouped split needs 'source_file' metadata; re-run loading with provenance.")
        return _grouped_class_aware_split(y, meta, random_state)

    if strategy == "temporal":
        if "capture_timestamp_ms" not in meta.columns:
            raise ValueError("Temporal split needs 'capture_timestamp_ms' metadata.")
        # The timestamp orders the stream here; it is never a feature (#46).
        order = np.argsort(meta["capture_timestamp_ms"].values, kind="stable")
        n_train = int(0.70 * len(order))
        n_val = int(0.85 * len(order))
        return order[:n_train], order[n_train:n_val], order[n_val:]

    raise ValueError(f"Unknown split strategy {strategy!r}")


def _report_class_coverage(y, train_idx, val_idx, test_idx, strategy: str) -> None:
    """Warn when a split leaves a class absent from a partition."""
    target = y["Label_Multiclass"].values
    all_classes = set(np.unique(target))
    for name, idx in (("train", train_idx), ("val", val_idx), ("test", test_idx)):
        missing = sorted(all_classes - set(np.unique(target[idx])))
        if missing:
            logger.warning("[%s split] '%s' partition is missing %d class(es): %s",
                           strategy, name, len(missing), missing)


def split_and_export_data(
    X: pd.DataFrame,
    y: pd.DataFrame,
    meta: pd.DataFrame = None,
    output_dir: str = "data/processed",
    strategy: str = "random",
    random_state: int = 42,
    scaler_path: str = None,
) -> None:
    """
    Split into 70/15/15, fit StandardScaler on the training partition only, and
    export X/y/meta for each partition.
    """
    if X.empty or y.empty:
        logger.warning("Empty features or target passed to split_and_export_data. Skipping export.")
        return

    if meta is None:
        meta = pd.DataFrame(index=X.index)

    os.makedirs(output_dir, exist_ok=True)

    train_idx, val_idx, test_idx = _split_indices(X, y, meta, strategy, random_state)
    _report_class_coverage(y, train_idx, val_idx, test_idx, strategy)

    logger.info(
        "Split '%s' -> Train: %d (%.1f%%), Val: %d (%.1f%%), Test: %d (%.1f%%)",
        strategy,
        len(train_idx), 100 * len(train_idx) / len(X),
        len(val_idx), 100 * len(val_idx) / len(X),
        len(test_idx), 100 * len(test_idx) / len(X),
    )

    partitions = {"train": train_idx, "val": val_idx, "test": test_idx}

    logger.info("Fitting StandardScaler on the training partition only...")
    scaler = StandardScaler()
    scaler.fit(X.iloc[train_idx])

    # The scaler belongs with the dataset it was fitted on, so a versioned run
    # cannot silently invalidate the models trained against an earlier one.
    local_scaler = os.path.join(output_dir, "StandardScaler.pkl")
    with open(local_scaler, "wb") as handle:
        pickle.dump(scaler, handle)
    logger.info("Saved StandardScaler to %s", local_scaler)

    if scaler_path:
        os.makedirs(os.path.dirname(scaler_path) or ".", exist_ok=True)
        with open(scaler_path, "wb") as handle:
            pickle.dump(scaler, handle)
        logger.info("Published StandardScaler to %s", scaler_path)

    for name, idx in partitions.items():
        X_part = pd.DataFrame(scaler.transform(X.iloc[idx]), columns=X.columns)
        X_part.to_csv(os.path.join(output_dir, f"X_{name}.csv"), index=False)
        y.iloc[idx].reset_index(drop=True).to_csv(os.path.join(output_dir, f"y_{name}.csv"), index=False)
        if not meta.empty:
            meta.iloc[idx].reset_index(drop=True).to_csv(
                os.path.join(output_dir, f"meta_{name}.csv"), index=False
            )

    exported = 6 if meta.empty else 9
    logger.info("Exported %d dataset CSV files to '%s'.", exported, output_dir)


def main():
    parser = argparse.ArgumentParser(description="EVNet Sentinel Data Preprocessing Pipeline")
    parser.add_argument("--raw_dir", type=str, default="data/raw",
                        help="Directory containing the extracted CICEVSE2024 archive")
    parser.add_argument("--output_dir", type=str, default="data/processed",
                        help="Destination for the processed CSVs")
    parser.add_argument("--feature-set", dest="feature_set", choices=["reference", "extended"],
                        default="extended",
                        help="'reference' matches the upstream notebook; 'extended' keeps ports (#51)")
    parser.add_argument("--split", choices=["random", "grouped", "temporal"], default="random",
                        help="Split strategy (#50). 'grouped' holds out whole captures.")
    parser.add_argument("--dedup", choices=["global", "per-capture", "none"], default="global",
                        help="Deduplication scope (#48). 'global' matches the reference but "
                             "destroys provenance; use 'per-capture' with --split grouped.")
    parser.add_argument("--random-state", dest="random_state", type=int, default=42)
    parser.add_argument("--publish-scaler", dest="scaler_path", nargs="?",
                        const=os.path.join(PROJECT_ROOT, "saved_models", "StandardScaler.pkl"),
                        default=None,
                        help="Also copy the fitted scaler here (defaults to saved_models/StandardScaler.pkl). "
                             "Omit to leave existing model artifacts untouched.")
    args = parser.parse_args()

    logger.info("--- Starting EVNet Sentinel Preprocessing Pipeline ---")
    logger.info("feature-set=%s  split=%s  dedup=%s  seed=%d",
                args.feature_set, args.split, args.dedup, args.random_state)

    df = load_network_traffic_data(base_dir=args.raw_dir)
    if df.empty:
        logger.warning("No data found to process. Exiting pipeline.")
        return

    if args.split == "grouped" and args.dedup == "global":
        logger.warning(
            "--split grouped with --dedup global: global deduplication can absorb an entire "
            "capture into another, so held-out captures may not be truly held out. "
            "Consider --dedup per-capture.")

    df_cleaned = clean_and_reduce_features(df, feature_set=args.feature_set, dedup=args.dedup)
    X, y, meta = engineer_features(df_cleaned)
    split_and_export_data(X, y, meta, output_dir=args.output_dir,
                          strategy=args.split, random_state=args.random_state,
                          scaler_path=args.scaler_path)
    logger.info("--- Pipeline Completed Successfully ---")


if __name__ == "__main__":
    main()
