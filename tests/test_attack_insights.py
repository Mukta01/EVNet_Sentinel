"""
Tests for the per-attack harness and the response playbook.

These run without the dataset or trained models, so they execute in CI. The
harness itself needs both and is run with `make attack-test`.
"""

import json
import os
import sys

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.data_prep.preprocess import EXPECTED_CLASSES
from src.evaluation.attack_test_harness import DOS, GATES, RECON, category, verdict_for

PLAYBOOK = os.path.join(os.path.dirname(__file__), "..", "src", "evaluation", "response_playbook.json")


def load_playbook():
    with open(PLAYBOOK) as handle:
        return json.load(handle)


# ── category mapping ───────────────────────────────────────────────────────

def test_every_class_has_exactly_one_response_category():
    for cls in EXPECTED_CLASSES:
        assert category(cls) in ("dos", "recon", "benign"), cls
    assert not DOS & RECON, "a class cannot be both DoS and reconnaissance"
    assert set(EXPECTED_CLASSES) == DOS | RECON | {"Benign"}


def test_all_six_nmap_modes_are_reconnaissance():
    for cls in ["TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection",
                "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"]:
        assert category(cls) == "recon"


def test_low_rate_floods_are_still_denial_of_service():
    """Hard to detect is not the same as a different kind of attack."""
    for cls in ["ICMP_Flood", "ICMP_Fragmentation", "Slowloris_Scan"]:
        assert category(cls) == "dos"


# ── verdicts ────────────────────────────────────────────────────────────────

def test_verdict_ladder():
    assert verdict_for(1.0, 1.0, 0.95) == "identified"
    assert verdict_for(1.0, 0.95, 0.20) == "category"   # knows it is a scan, not which
    assert verdict_for(0.95, 0.60, 0.20) == "detected"  # knows something is wrong
    assert verdict_for(0.40, 0.30, 0.10) == "missed"


def test_benign_is_graded_on_false_alarms_not_misses():
    assert verdict_for(0.95, 0.95, 0.95, benign=True) == "clean"
    assert verdict_for(0.10, 0.10, 0.10, benign=True) == "false-alarm"


def test_reconnaissance_exact_naming_is_not_gated():
    """The audit showed recon naming is limited by the data; gating it would
    only produce a permanently red build."""
    assert "recon_exact" not in GATES
    assert GATES["recon_category"] < 0.9, "gate must sit below today's ~0.89 floor"


# ── playbook ────────────────────────────────────────────────────────────────

def test_playbook_covers_every_class_the_detector_can_output():
    pb = load_playbook()
    missing = sorted(set(EXPECTED_CLASSES) - set(pb["attacks"]))
    assert not missing, f"no response guidance for: {missing}"


def test_playbook_categories_match_the_harness():
    pb = load_playbook()
    for cls, entry in pb["attacks"].items():
        assert entry["category"] == category(cls), f"{cls}: playbook says {entry['category']}"


def test_every_attack_category_gives_each_role_something_to_do():
    pb = load_playbook()
    for cat in ("dos", "recon"):
        for role in pb["roles"]:
            assert pb["categories"][cat]["actions"][role], f"{cat}: nothing for {role}"


def test_every_attack_has_a_plain_description_and_severity():
    pb = load_playbook()
    for cls, entry in pb["attacks"].items():
        assert entry["what"].strip(), cls
        assert entry["severity"] in ("critical", "high", "medium", "none"), cls


def test_reconnaissance_carries_the_uncertainty_warning():
    """Operators must be told to act on the category when naming is unreliable."""
    assert load_playbook()["categories"]["recon"]["uncertainty"].strip()
