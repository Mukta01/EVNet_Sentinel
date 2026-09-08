"""
Test whether ADWIN drift events coincide with capture-file boundaries (issue #53).

The paper reports 11-12 "concept drift events" and presents them as drift in EVCS
traffic. CICEVSE2024 is 59 capture files concatenated end to end, so the competing
explanation is that the detector is firing on the seams between captures.

This compares each drift event's instance index against the positions where
`source_file` changes in the stream, and calibrates against a null model that
places the same number of events uniformly at random.

Usage
-----
    python3 src/reproduction/drift_boundary_alignment.py \
        --drift-log predictions/arf-full/arf_full_file_drift_events_multiclass.json \
        --meta      data/processed_v2/extended-unscaled/meta_train.csv
"""

import argparse
import json

import numpy as np
import pandas as pd


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--drift-log", dest="drift_log", required=True)
    parser.add_argument("--meta", required=True)
    parser.add_argument("--draws", type=int, default=2000, help="Null-model resamples")
    parser.add_argument("--window", type=int, default=1000,
                        help="Instances within which an event counts as 'on a boundary'")
    args = parser.parse_args()

    # Reconstruct the stream order used by --stream-order file.
    meta = pd.read_csv(args.meta).sort_values("capture_timestamp_ms", kind="stable")
    source = meta["source_file"].to_numpy()
    boundaries = np.flatnonzero(source[1:] != source[:-1]) + 1
    print(f"stream: {len(source):,} instances | {meta.source_file.nunique()} captures "
          f"| {len(boundaries)} boundaries")

    events = json.load(open(args.drift_log))["events"]
    if not events:
        print("No drift events in this log.")
        return
    index = np.array([e["instance"] for e in events])
    distance = np.abs(index[:, None] - boundaries[None, :]).min(axis=1)

    print(f"\n{len(events)} drift events, distance to nearest capture boundary:")
    for window in (0, 100, 1000, 5000, 20000):
        hit = int((distance <= window).sum())
        print(f"  within {window:>6,}: {hit:>3}/{len(events)}  ({100 * hit / len(events):5.1f}%)")
    print(f"  median {np.median(distance):,.0f} | mean {distance.mean():,.0f}")

    rng = np.random.RandomState(0)
    null = np.array([
        (np.abs(rng.randint(0, len(source), len(events))[:, None]
                - boundaries[None, :]).min(axis=1) <= args.window).sum()
        for _ in range(args.draws)
    ])
    observed = int((distance <= args.window).sum())
    print(f"\nnull model ({args.draws} draws, window {args.window:,}):")
    print(f"  observed {observed}/{len(events)} | expected {null.mean():.1f} +/- {null.std():.1f}"
          f" | empirical p = {(null >= observed).mean():.4f}")


if __name__ == "__main__":
    main()
