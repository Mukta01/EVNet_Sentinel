"""
The containment policy, replayed on the real held-out flows the simulation
console uses (frontend/data/network-sim.json) with each flow's recorded sender
(frontend/data/attack-routes.json).
"""

import json
import os

import pytest

from src.response.containment import Observation, SiteState, load_policy

DATA = os.path.join(os.path.dirname(__file__), "..", "frontend", "data")
SIM = json.load(open(os.path.join(DATA, "network-sim.json")))
ROUTES = json.load(open(os.path.join(DATA, "attack-routes.json")))["captures"]
FLOWS = {f["id"]: f for f in SIM["flows"]}
RF = str(SIM["models"].index("RandomForest"))
POLICY = load_policy()
FLOODS = ["SYN_Flood", "TCP_Flood", "UDP_Flood", "PSHACK_Flood", "SynonymousIP_Flood"]
SCANS = ["TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection",
         "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"]


def category(group):
    return "recon" if group == "recon" else "benign" if group == "benign" else "dos"


def observe(state, flow_id, model=RF):
    flow = FLOWS[flow_id]
    label, group, _, confidence, *_ = flow["p"][model] + [None] * 2
    attack = flow["trueLabel"] != "Benign"
    sender = ROUTES.get(flow["capture"], {}).get("sender") if attack else None
    return state.observe(Observation(label != "Benign", category(group), confidence, sender))


def stream(state, cls, n):
    pool = SIM["byClass"][cls]
    return [observe(state, pool[i % len(pool)]) for i in range(n)]


def test_policy_file_is_consistent():
    assert 0 < POLICY["elevatedShare"] < POLICY["unsafeShare"] <= 1
    assert POLICY["minFlows"] <= POLICY["window"]
    assert POLICY["quarantine"]["categories"] == ["dos"]


def test_normal_traffic_stays_safe():
    state = SiteState(POLICY)
    levels = stream(state, "Benign", 200)
    assert "unsafe" not in levels
    assert state.recommendation is None


@pytest.mark.parametrize("flood", FLOODS)
def test_every_flood_escalates_and_names_its_sender(flood):
    state = SiteState(POLICY)
    stream(state, "Benign", 20)
    stream(state, flood, POLICY["window"])
    assert state.level == "unsafe"
    expected = {ROUTES[FLOWS[i]["capture"]]["sender"] for i in SIM["byClass"][flood]}
    assert state.recommendation in expected


@pytest.mark.parametrize("scan", SCANS)
def test_scans_raise_the_level_but_never_quarantine(scan):
    state = SiteState(POLICY)
    stream(state, scan, 60)
    assert state.level == "unsafe"
    assert state.recommendation is None


def test_quarantine_then_cool_down():
    state = SiteState(POLICY)
    stream(state, "SYN_Flood", POLICY["window"])
    attacker = state.recommendation
    state.approve(attacker)
    assert state.recommendation is None
    # With the attacker cut off, only normal traffic reaches the tap.
    stream(state, "Benign", POLICY["window"] + POLICY["cooldownFlows"] * 2)
    assert state.level == "safe"


def test_level_does_not_drop_on_one_quiet_flow():
    state = SiteState(POLICY)
    stream(state, "SYN_Flood", POLICY["window"])
    stream(state, "Benign", POLICY["cooldownFlows"] - 1)
    assert state.level == "unsafe"


def test_infrastructure_is_never_quarantined():
    state = SiteState(POLICY)
    for node in POLICY["protected"]:
        with pytest.raises(ValueError):
            state.approve(node)
        for _ in range(POLICY["window"]):
            state.observe(Observation(True, "dos", 1.0, node))
        assert state.recommendation is None
