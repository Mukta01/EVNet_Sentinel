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
PRIMARY = json.load(open(os.path.join(DATA, "insights.json")))["primary"]
MODEL = str(SIM["models"].index(PRIMARY))
POLICY = load_policy()
FLOODS = ["SYN_Flood", "TCP_Flood", "UDP_Flood", "PSHACK_Flood", "SynonymousIP_Flood"]
SCANS = ["TCP_Port_Scan", "SYN_Stealth_Scan", "Service_Version_Detection",
         "OS_Fingerprinting", "Aggressive_Scan", "Vulnerability_Scan"]


def category(group):
    return "recon" if group == "recon" else "benign" if group == "benign" else "dos"


def observe(state, flow_id, model=MODEL):
    flow = FLOWS[flow_id]
    label, group, _, confidence, *_ = flow["p"][model] + [None] * 2
    attack = flow["trueLabel"] != "Benign"
    sender = ROUTES.get(flow["capture"], {}).get("sender") if attack else None
    return state.observe(Observation(label != "Benign", category(group), confidence, sender))


def pool_of(cls, sender=None):
    pool = SIM["byClass"][cls]
    return [i for i in pool if not sender or ROUTES[FLOWS[i]["capture"]].get("sender") == sender]


def stream(state, cls, n, sender=None):
    pool = pool_of(cls, sender)
    return [observe(state, pool[i % len(pool)]) for i in range(n)]


def senders_of(cls):
    return {ROUTES[FLOWS[i]["capture"]]["sender"] for i in SIM["byClass"][cls]}


def flows_until(state, cls, sender, reason, limit=200):
    """Attack flows streamed until a recommendation with this reason appears."""
    pool = pool_of(cls, sender)
    for n in range(1, limit + 1):
        observe(state, pool[(n - 1) % len(pool)])
        if state.recommendation and state.recommendation.reason == reason:
            return n
    return None


def test_policy_file_is_consistent():
    assert 0 < POLICY["elevatedShare"] < POLICY["unsafeShare"] <= 1
    assert POLICY["minFlows"] <= POLICY["window"]
    assert POLICY["quarantine"]["categories"] == ["dos"]
    assert POLICY["restrict"]["categories"] == ["recon"]
    assert POLICY["escalate"]["minDetections"] < POLICY["quarantine"]["minDetections"]


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
    rec = state.recommendation
    assert rec.action == "quarantine" and rec.reason == "flood"
    assert rec.sender in senders_of(flood)


@pytest.mark.parametrize("scan", SCANS)
def test_scans_are_restricted_never_quarantined(scan):
    state = SiteState(POLICY)
    actions = set()
    for _ in range(60):
        stream(state, scan, 1)
        if state.recommendation:
            actions.add(state.recommendation.action)
    assert state.level == "unsafe"
    assert actions and "quarantine" not in actions
    assert state.watched


@pytest.mark.parametrize("scan", [s for s in SCANS if "evcc" in senders_of(s)])
def test_a_scanning_vehicle_gets_its_session_ended(scan):
    state = SiteState(POLICY)
    assert flows_until(state, scan, "evcc", "scan") is not None
    assert state.recommendation.action == "end-session"
    assert state.recommendation.sender == "evcc"


def test_a_scanner_that_starts_flooding_is_quarantined_sooner():
    fresh = SiteState(POLICY)
    stream(fresh, "Benign", 20)
    cold = flows_until(fresh, "SYN_Flood", "kali", "flood")

    warned = SiteState(POLICY)
    stream(warned, "Benign", 20)
    flows_until(warned, "TCP_Port_Scan", "kali", "scan")
    assert "kali" in warned.watched
    hot = flows_until(warned, "SYN_Flood", "kali", "escalation")

    assert warned.recommendation.action == "quarantine"
    assert hot is not None and cold is not None and hot < cold


def test_quarantine_then_cool_down():
    state = SiteState(POLICY)
    stream(state, "SYN_Flood", POLICY["window"])
    attacker = state.recommendation.sender
    state.approve(attacker)
    assert state.contained[attacker] == "quarantine"
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
