"""
Threat level and containment recommendations for one charging site.

EVNet Sentinel is passive: it watches a mirrored switch port and blocks
nothing. This module closes the loop on top of it. It turns the stream of
per-flow verdicts into a site threat level (safe / elevated / unsafe) and
recommends one containment action per attacking device. A person approves
every action; nothing here acts on its own.

Three actions, each matched to how reliable the detector is for that attack:

  quarantine     Cut the device off at the switch. For confident
                 denial-of-service detections: floods are named almost
                 perfectly, so the evidence is strong enough to cut someone off.
  restrict       Let the device keep its internet access but block it from the
                 charging stations and the CSMS. For reconnaissance: scans are
                 recognised as scans 96% of the time but named exactly only 34%,
                 so the response works on the category, never the exact name,
                 and is softer than a full quarantine.
  end-session    For a scan coming from a vehicle over the charging cable: the
                 station ends that charging session and refuses the vehicle
                 until it is checked. Quarantining "the car" at the switch
                 would do nothing, because its traffic never crosses the switch.

A device that scanned is then watched. If it later sends denial-of-service
traffic it is recommended for quarantine at a much lower bar (escalation): a
scan followed by an attack is the classic pattern, and the scan is the warning.

The rules live in frontend/data/containment-policy.json so the simulation
console applies exactly the same ones (frontend/lib/containment.ts), and
src/evaluation/replay_response.py measures them on the recorded attacks.

Other design choices, each backed by the per-attack results:
  * Only confident flows count towards a quarantine, because the detectors'
    wrong names mostly sit at low confidence (paper, Table XV).
  * Charging stations and the CSMS are never contained, so a false alarm can
    never take the site's own infrastructure offline.
  * The level drops only after a quiet period, so it does not flicker.
"""

import json
import os
from collections import deque
from dataclasses import dataclass, field

POLICY_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "data", "containment-policy.json")
LEVELS = ("safe", "elevated", "unsafe")
ACTIONS = ("quarantine", "restrict", "end-session")


def load_policy(path=POLICY_PATH):
    with open(path) as handle:
        return json.load(handle)


@dataclass
class Observation:
    flagged: bool            # the model called it anything but Benign
    category: str            # "dos", "recon" or "benign", of the predicted label
    confidence: float | None
    sender: str | None       # device the flow came from, if known


@dataclass
class Recommendation:
    sender: str
    action: str              # one of ACTIONS
    reason: str              # "flood", "scan" or "escalation"


@dataclass
class SiteState:
    policy: dict
    window: deque = field(default_factory=deque)
    level: str = "safe"
    calm: int = 0                       # consecutive flows below the current level
    contained: dict = field(default_factory=dict)   # sender -> approved action
    watched: set = field(default_factory=set)       # senders that have scanned
    recommendation: Recommendation | None = None

    @property
    def quarantined(self):
        """Every device whose attack traffic is now stopped, whatever the action."""
        return set(self.contained)

    def _target_level(self):
        n = len(self.window)
        if n < self.policy["minFlows"]:
            return "safe"
        share = sum(o.flagged for o in self.window) / n
        if share >= self.policy["unsafeShare"]:
            return "unsafe"
        if share >= self.policy["elevatedShare"]:
            return "elevated"
        return "safe"

    def _counts(self, rule):
        counts = {}
        for o in self.window:
            if (o.flagged and o.sender and o.category in rule["categories"]
                    and (o.confidence or 0) >= rule.get("minConfidence", 0)
                    and o.sender not in self.policy["protected"]
                    and o.sender not in self.contained):
                counts[o.sender] = counts.get(o.sender, 0) + 1
        return counts

    @staticmethod
    def _top(counts, need):
        best = max(counts.items(), key=lambda kv: kv[1], default=None)
        return best[0] if best and best[1] >= need else None

    def _recommend(self):
        p = self.policy
        # 1. Escalation: a device that scanned earlier is now attacking.
        rule = p["escalate"]
        hits = {s: n for s, n in self._counts(rule).items() if s in self.watched}
        sender = self._top(hits, rule["minDetections"])
        if sender:
            return Recommendation(sender, "quarantine", "escalation")
        # 2. A confident flood while the site is unsafe.
        if self.level == "unsafe":
            rule = p["quarantine"]
            sender = self._top(self._counts(rule), rule["minDetections"])
            if sender:
                return Recommendation(sender, "quarantine", "flood")
        # 3. A device scanning the site.
        rule = p["restrict"]
        if LEVELS.index(self.level) >= LEVELS.index(rule["minLevel"]):
            sender = self._top(self._counts(rule), rule["minDetections"])
            if sender:
                action = "end-session" if sender in p["vehicles"] else "restrict"
                return Recommendation(sender, action, "scan")
        return None

    def observe(self, obs: Observation):
        self.window.append(obs)
        while len(self.window) > self.policy["window"]:
            self.window.popleft()
        target = self._target_level()
        if LEVELS.index(target) >= LEVELS.index(self.level):
            self.level, self.calm = target, 0
        else:
            self.calm += 1
            if self.calm >= self.policy["cooldownFlows"]:
                self.level, self.calm = target, 0
        self.recommendation = self._recommend()
        if self.recommendation and self.recommendation.reason == "scan":
            self.watched.add(self.recommendation.sender)
        return self.level

    def approve(self, sender, action=None):
        if sender in self.policy["protected"]:
            raise ValueError(f"{sender} is site infrastructure and cannot be contained")
        rec = self.recommendation
        if action is None:
            action = rec.action if rec and rec.sender == sender else "quarantine"
        if action not in ACTIONS:
            raise ValueError(f"unknown action {action!r}")
        self.contained[sender] = action
        self.recommendation = None

    def release(self, sender):
        self.contained.pop(sender, None)
