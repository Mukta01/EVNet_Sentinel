"""
Emit a reproducibility manifest for the CICEVSE2024 Network Traffic capture set (#55).

The dataset is access-restricted and has no public version string, so the way to
pin "which copy of CICEVSE2024 produced these numbers" is to fingerprint the
capture files themselves. This records every file's size, row count and SHA-256,
plus an aggregate hash over the sorted per-file digests.

Usage
-----
    python3 src/reproduction/dataset_manifest.py \
        --raw-dir "datasets/CICEVSE2024_Dataset" --output docs/dataset_manifest.json
"""

import argparse
import glob
import hashlib
import json
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))


def sha256(path, chunk=1 << 20):
    digest = hashlib.sha256()
    with open(path, "rb") as handle:
        for block in iter(lambda: handle.read(chunk), b""):
            digest.update(block)
    return digest.hexdigest()


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", dest="raw_dir", default="datasets/CICEVSE2024_Dataset")
    parser.add_argument("--output", default="docs/dataset_manifest.json")
    args = parser.parse_args()

    from src.data_prep.preprocess import _derive_state, _normalise_label

    paths = sorted(
        p for p in glob.glob(os.path.join(args.raw_dir, "**", "Network Traffic", "**", "*.csv"),
                             recursive=True)
        if os.path.basename(p).lower().startswith("evse-")
    )
    if not paths:
        raise SystemExit(f"No capture CSVs found under {args.raw_dir}")

    files, total_rows = [], 0
    for path in paths:
        name = os.path.basename(path)
        stem = os.path.splitext(name)[0]
        with open(path, "rb") as handle:
            rows = sum(1 for _ in handle) - 1  # minus header
        total_rows += rows
        files.append({
            "file": name,
            "label": _normalise_label(stem),
            "evse": "EVSE-A" if "evse-a" in stem.lower() else "EVSE-B",
            "state": _derive_state(stem),
            "rows": rows,
            "bytes": os.path.getsize(path),
            "sha256": sha256(path),
        })

    aggregate = hashlib.sha256(
        "".join(f["sha256"] for f in sorted(files, key=lambda f: f["file"])).encode()
    ).hexdigest()

    manifest = {
        "source": "CICEVSE2024 — Canadian Institute for Cybersecurity, Network Traffic subset",
        "capture_files": len(files),
        "total_rows": total_rows,
        "classes": sorted({f["label"] for f in files}),
        "aggregate_sha256": aggregate,
        "files": files,
    }

    os.makedirs(os.path.dirname(args.output) or ".", exist_ok=True)
    with open(args.output, "w") as handle:
        json.dump(manifest, handle, indent=2)

    print(f"capture files : {len(files)}")
    print(f"total rows    : {total_rows:,}")
    print(f"classes       : {len(manifest['classes'])}")
    print(f"aggregate hash: {aggregate}")
    print(f"[+] Wrote {args.output}")


if __name__ == "__main__":
    main()
