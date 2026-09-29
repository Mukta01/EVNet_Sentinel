"""
Who attacked what in CICEVSE2024, measured from the captures themselves.

The dataset's Network Traffic/Readme.txt lists the testbed devices and their MAC
addresses but not which device attacked which. Every flow record carries
src_mac and dst_mac, so for each capture file this identifies the attacking
device and the device it targeted, and the interface the target was hit on.

Writes frontend/data/attack-routes.json, which drives the simulation console's
packet routes and the landing page, and prints the table used in
docs/EVNet_Sentinel_Findings.tex.

Findings when run on the published captures:
  * Every attack targets a charging station (EVSE-A or EVSE-B). None targets
    the CSMS or the vehicle.
  * The Kali PC runs every attack type except UDP floods; UDP floods come from a
    Raspberry Pi whose MAC (dc:a6:32:dc:27:d5) differs by one hex digit from the
    Readme's (dc:a6:32:dc:25:d5) -- treated here as a typo in the Readme.
  * The six "MaliciousEV" captures are scans sent by the vehicle (EVCC) to
    EVSE-B over the ISO 15118 cable link.
  * The ICMP captures are tiny (2-30 flows) and mostly background traffic; only
    a minority of their flows involve the attacker, so "attributed" is low there.

The captures were recorded from a mirrored switch port (network toplogy_updated.pdf
in the same directory), i.e. passively: the IDS observes, it does not block.

Usage
-----
    python3 src/reproduction/attack_routes.py \
        --raw-dir "datasets/CICEVSE2024_Dataset/Network Traffic"
"""

import argparse
import collections
import glob
import json
import os

import pandas as pd

DEVICES = {
    "0c:8b:95:09:c6:08": ("evse-a", "wifi"),
    "dc:a6:32:c9:e5:5f": ("evse-b", "wifi"),
    "dc:a6:32:c9:e5:5e": ("evse-b", "v2g"),
    "dc:a6:32:c9:e6:9f": ("evcc", "v2g"),
    "dc:a6:32:c9:e5:3e": ("local-csms", "wifi"),
    "a8:6b:ad:1f:9b:e5": ("kali", "wifi"),
    "dc:a6:32:dc:25:d5": ("rpi", "wifi"),  # as printed in the Readme
    "dc:a6:32:dc:27:d5": ("rpi", "wifi"),  # as observed in the UDP-flood captures
}
ATTACKERS = {"kali", "rpi"}


def route(path):
    frame = pd.read_csv(path, usecols=["src_mac", "dst_mac"], low_memory=False)
    malicious_ev = "maliciousev" in os.path.basename(path).lower()
    attackers = ATTACKERS | ({"evcc"} if malicious_ev else set())
    senders, targets, ifaces = collections.Counter(), collections.Counter(), collections.Counter()
    for src, dst in zip(frame.src_mac.str.lower(), frame.dst_mac.str.lower()):
        a, b = DEVICES.get(src), DEVICES.get(dst)
        # Either direction counts: replies (e.g. ICMP echo replies) point the other way.
        for me, other in ((a, b), (b, a)):
            if me and me[0] in attackers and other and other[0] not in attackers:
                senders[me[0]] += 1
                targets[other[0]] += 1
                ifaces[other[1]] += 1
                break
    attributed = sum(senders.values())
    return {
        "flows": int(len(frame)),
        "attributed": round(attributed / max(1, len(frame)), 3),
        "sender": senders.most_common(1)[0][0] if senders else None,
        "target": targets.most_common(1)[0][0] if targets else None,
        "iface": {k: round(v / attributed, 3) for k, v in ifaces.items()} if attributed else {},
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--raw-dir", default="datasets/CICEVSE2024_Dataset/Network Traffic")
    parser.add_argument("--out", default="frontend/data/attack-routes.json")
    args = parser.parse_args()

    files = sorted(glob.glob(os.path.join(args.raw_dir, "*", "csv", "*.csv")))
    if not files:
        raise SystemExit(f"No captures under {args.raw_dir}")
    routes = {}
    for path in files:
        name = os.path.basename(path)
        routes[name] = route(path) if "benign" not in name.lower() else {"benign": True}
        r = routes[name]
        if r.get("benign"):
            print(f"  {name:48s} benign")
        else:
            iface = ", ".join(f"{k} {v:.0%}" for k, v in r["iface"].items())
            print(f"  {name:48s} {str(r['sender']):>5} -> {str(r['target']):7s} "
                  f"({r['attributed']:.0%} of {r['flows']:,} flows; {iface})")

    attacks = [r for r in routes.values() if not r.get("benign")]
    by_pair = collections.Counter((r["sender"], r["target"]) for r in attacks)
    print("\nsender -> target      captures")
    for (s, t), n in sorted(by_pair.items(), key=lambda kv: -kv[1]):
        print(f"  {str(s):>5} -> {str(t):7s}  {n}")

    os.makedirs(os.path.dirname(args.out) or ".", exist_ok=True)
    with open(args.out, "w") as handle:
        json.dump({"source": "src/reproduction/attack_routes.py", "captures": routes}, handle, indent=1)
    print(f"\n[+] {args.out}")


if __name__ == "__main__":
    main()
