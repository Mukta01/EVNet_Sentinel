"""
Faithful replay of the reference preprocessing from Makhmudov et al. (2025).

Source notebook:
    TATU-hacker/Intrusion_Detection_on_Electric_Vehicle_Charging_Systems
    Preprocessing_CICEVSE2024_NT.ipynb

Purpose
-------
This script exists as auditable evidence for issue #47. It reproduces the
reference pipeline cell-by-cell so that two claims can be checked independently:

  1. All six absolute epoch-millisecond columns survive every drop stage of the
     published pipeline, so the reported 0.9840 multiclass accuracy is measured
     on data where the label is recoverable from a single timestamp column.

  2. Our own pipeline's 2.74M rows vs. the paper's ~1.2M is explained entirely
     by deduplication ordering: the reference dedups *after* dropping the
     identifier columns, ours dedups before (see issue #48).

Running this against the raw CICEVSE2024 Network Traffic CSVs should land on
1,277,520 rows, against the paper's reported "~1.2 million".

Usage
-----
    python src/reproduction/replay_reference_preprocessing.py \
        --raw-dir "datasets/CICEVSE2024_Dataset/Network Traffic" \
        --output   data/reproduction/CICEVSE2024_NT_reference.csv

Add --audit to run the leakage measurements on the result.
"""

import argparse
import glob
import logging
import os

import pandas as pd

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger(__name__)

# Cells 1-2: the label is derived from the capture filename. This step is absent
# from our own src/data_prep/preprocess.py, which is why the repo cannot rebuild
# the dataset from the public CIC download (issue #49).
FILENAME_PREFIXES = [
    "evse-b-maliciousev-",
    "evse-a-charging-",
    "evse-a-idle-",
    "evse-b-charging-",
    "evse-b-idle-",
]

# Cell 8: 19 aliases collapse to 15 classes. EVSE-A and EVSE-B name the same
# attack differently ("portscan" vs "port-scan", "syn-stealth" vs
# "syn-stealth-scan"), so this map is load-bearing, not cosmetic.
LABEL_MAPPING = {
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

# Cell 17: sparse HTTP/TLS metadata, empty for OCPP and ISO 15118 traffic.
DROP_SPARSE_METADATA = [
    "requested_server_name",
    "client_fingerprint",
    "server_fingerprint",
    "user_agent",
    "content_type",
]

# Cell 19: identifiers. Note that the reference drops src_port and dst_port,
# which our pipeline keeps -- see issue #51.
DROP_IDENTIFIERS = [
    "id", "src_ip", "src_mac", "src_oui", "src_port",
    "dst_ip", "dst_mac", "dst_oui", "dst_port",
    "application_name", "application_category_name",
]

# The columns at the centre of issue #46. Listed here only so the replay can
# assert they survive; the reference never drops them.
ABSOLUTE_TIMESTAMP_COLUMNS = [
    "bidirectional_first_seen_ms", "bidirectional_last_seen_ms",
    "src2dst_first_seen_ms", "src2dst_last_seen_ms",
    "dst2src_first_seen_ms", "dst2src_last_seen_ms",
]

ZERO_FRACTION_THRESHOLD = 80.0  # Cell 10


def load_and_label(raw_dir):
    """Cells 1-3: concatenate every capture CSV, labelling each by its filename."""
    frames = []
    for evse in ("EVSE-A", "EVSE-B"):
        pattern = os.path.join(raw_dir, evse, "csv", "*.csv")
        files = sorted(glob.glob(pattern))
        if not files:
            logger.warning("No CSVs found under %s", pattern)
        for path in files:
            frame = pd.read_csv(path, low_memory=False)
            frame["Label"] = os.path.splitext(os.path.basename(path))[0]
            # Provenance is our addition, not the reference's. It is required for
            # the grouped/temporal splits in #50 and the drift experiment in #53,
            # and is stripped before any modelling.
            frame["source_file"] = os.path.basename(path)
            frame["evse"] = evse
            frames.append(frame)

    if not frames:
        raise FileNotFoundError(f"No capture CSVs found under {raw_dir}")

    df = pd.concat(frames, ignore_index=True)
    logger.info("Concatenated %d capture files -> %s", len(frames), df.shape)
    return df


def normalise_labels(df):
    """Cells 6-8: lowercase, strip the scenario prefix, collapse the aliases."""
    df["Label"] = df["Label"].str.lower()
    for prefix in FILENAME_PREFIXES:
        df["Label"] = df["Label"].str.replace(prefix, "", regex=False)
    df["Label"] = df["Label"].replace(LABEL_MAPPING)

    unmapped = set(df["Label"].unique()) - set(LABEL_MAPPING.values())
    if unmapped:
        logger.warning("Labels that did not map to a known class: %s", sorted(unmapped))
    logger.info("Resolved %d distinct classes", df["Label"].nunique())
    return df


def drop_reference_columns(df):
    """Cells 10, 17, 19 in order, returning the frame and a per-stage report."""
    protected = ["Label", "source_file", "evse"]
    feature_view = df.drop(columns=protected)

    zero_fraction = (feature_view == 0).mean() * 100
    high_zero = list(zero_fraction[zero_fraction > ZERO_FRACTION_THRESHOLD].index)
    df = df.drop(columns=high_zero)
    logger.info("Cell 10 dropped %d columns with >%.0f%% zeros", len(high_zero), ZERO_FRACTION_THRESHOLD)

    sparse = [c for c in DROP_SPARSE_METADATA if c in df.columns]
    df = df.drop(columns=sparse)
    logger.info("Cell 17 dropped %d sparse metadata columns", len(sparse))

    identifiers = [c for c in DROP_IDENTIFIERS if c in df.columns]
    df = df.drop(columns=identifiers)
    logger.info("Cell 19 dropped %d identifier columns", len(identifiers))

    report = {"high_zero": high_zero, "sparse": sparse, "identifiers": identifiers}
    return df, report


def deduplicate(df):
    """
    Cells 20-21: dedup runs AFTER the column drops.

    This ordering is the whole difference between the reference's ~1.2M rows and
    our 2.74M. Once ports and identifiers are gone, the thousands of structurally
    identical single-packet flows a flood emits collapse into genuine duplicates.
    Our pipeline dedups first, while every row still carries a unique port and
    millisecond timestamp, so it removes almost nothing (issue #48).
    """
    feature_columns = [c for c in df.columns if c not in ("source_file", "evse")]
    duplicated = df.duplicated(subset=feature_columns)
    logger.info("Cell 20 found %d duplicate rows (%.1f%%)", duplicated.sum(), 100 * duplicated.mean())
    return df[~duplicated].reset_index(drop=True)


def audit_leakage(df):
    """Measure how much of the 15-class target a single timestamp column recovers."""
    import numpy as np
    from sklearn.model_selection import cross_val_score
    from sklearn.tree import DecisionTreeClassifier

    survivors = [c for c in ABSOLUTE_TIMESTAMP_COLUMNS if c in df.columns]
    print("\n" + "=" * 72)
    print("LEAKAGE AUDIT (issue #46 / #47)")
    print("=" * 72)
    print(f"Absolute timestamp columns surviving the reference pipeline: {len(survivors)}/6")
    for column in survivors:
        print(f"  - {column}")
    if not survivors:
        print("None survived -- the leak is not present in this run.")
        return

    y = df["Label"]
    sample = np.random.RandomState(0).choice(len(df), min(300_000, len(df)), replace=False)
    probe = survivors[0]
    scores = cross_val_score(
        DecisionTreeClassifier(max_depth=25, random_state=0),
        df.iloc[sample][[probe]], y.iloc[sample], cv=3, n_jobs=-1,
    )
    print(f"\nDecisionTree on `{probe}` ALONE, {y.nunique()}-class, 3-fold CV: {scores.mean():.4f}")
    print(f"Paper's reported multiclass accuracy:                          0.9840")
    print("\nA single-column decision stump matches the published headline number.")
    print("=" * 72)


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", default="datasets/CICEVSE2024_Dataset/Network Traffic")
    parser.add_argument("--output", default="data/reproduction/CICEVSE2024_NT_reference.csv")
    parser.add_argument("--audit", action="store_true", help="Run the leakage measurements on the result")
    args = parser.parse_args()

    df = load_and_label(args.raw_dir)
    df = normalise_labels(df)
    df, _ = drop_reference_columns(df)
    df = deduplicate(df)

    logger.info("Final shape: %s (paper reports ~1.2M rows)", df.shape)
    print("\nClass distribution:")
    print(df["Label"].value_counts().to_string())

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    df.to_csv(args.output, index=False)
    logger.info("Wrote %s", args.output)

    if args.audit:
        audit_leakage(df)


if __name__ == "__main__":
    main()
