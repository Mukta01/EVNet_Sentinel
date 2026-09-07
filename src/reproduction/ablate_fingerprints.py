"""
Clean 2x2 ablation for Finding 2 of the leakage audit (issues #47, #58).

Holds the reference feature set fixed and toggles only two columns -- the six
absolute capture timestamps and `dst_port` -- then deduplicates as the reference
does. Establishes that reconnaissance traffic in CICEVSE2024 is distinguished
almost entirely by those two columns, and that each is independently
near-sufficient, so neither alone can be blamed for the collapse.

The reference pipeline is the row `timestamps=kept, dst_port=dropped`: it
discards the legitimate discriminator and keeps the artifact.

Usage
-----
    python3 src/reproduction/ablate_fingerprints.py
"""
import pandas as pd, itertools, sys
sys.path.insert(0, ".")
from src.data_prep.preprocess import ABSOLUTE_TIMESTAMP_COLUMNS

import glob, os
from src.data_prep.preprocess import _normalise_label

frames = []
for f in sorted(glob.glob("datasets/CICEVSE2024_Dataset/**/Network Traffic/**/*.csv", recursive=True)):
    b = os.path.basename(f)
    if not b.lower().startswith("evse-"):
        continue
    d = pd.read_csv(f, low_memory=False)
    d["Label"] = _normalise_label(os.path.splitext(b)[0])
    frames.append(d)
df = pd.concat(frames, ignore_index=True)

# Reference pipeline drops (cells 10/17/19), minus the two toggles.
pct_zero = (df.drop(columns=["Label"]) == 0).mean() * 100
high_zero = list(pct_zero[pct_zero > 80].index)
base_drop = set(high_zero) | {
    "requested_server_name","client_fingerprint","server_fingerprint","user_agent","content_type",
    "id","src_ip","src_mac","src_oui","src_port","dst_ip","dst_mac","dst_oui",
    "application_name","application_category_name"}
base_drop -= {"dst_port"}          # dst_port handled by the toggle
base_drop -= set(ABSOLUTE_TIMESTAMP_COLUMNS)  # timestamps handled by the toggle

RECON = ["SYN_Stealth_Scan","TCP_Port_Scan","Service_Version_Detection",
         "Vulnerability_Scan","OS_Fingerprinting","Aggressive_Scan"]
FLOOD = ["SYN_Flood","SynonymousIP_Flood","TCP_Flood","PSHACK_Flood","UDP_Flood"]

rows = []
for keep_ts, keep_dst in itertools.product([True, False], [True, False]):
    drop = set(base_drop)
    if not keep_ts:
        drop |= set(ABSOLUTE_TIMESTAMP_COLUMNS)
    if not keep_dst:
        drop |= {"dst_port"}
    sub = df.drop(columns=[c for c in drop if c in df.columns]).drop_duplicates()
    counts = sub["Label"].value_counts()
    rows.append({
        "timestamps": "kept" if keep_ts else "dropped",
        "dst_port": "kept" if keep_dst else "dropped",
        "total": len(sub),
        "recon": int(counts.reindex(RECON).fillna(0).sum()),
        "flood": int(counts.reindex(FLOOD).fillna(0).sum()),
    })

out = pd.DataFrame(rows)
out["recon_%_of_max"] = (100 * out.recon / out.recon.max()).round(2)
print(out.to_string(index=False))
print("\n*** the reference pipeline is the row: timestamps=kept, dst_port=dropped ***")
