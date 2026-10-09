"""
Threat level and quarantine recommendation for one charging site.

EVNet Sentinel is passive: it watches a mirrored switch port and blocks
nothing. This module models the response an operator could take on top of it.
It turns the stream of per-flow verdicts into a site threat level
(safe / elevated / unsafe) and, only for confident denial-of-service
detections from an identified device, recommends quarantining that device at
the switch. A person approves the quarantine; nothing here acts on its own.

The rules live in frontend/data/containment-policy.json so the simulation
console applies exactly the same ones (frontend/lib/containment.ts).

Design choices, each backed by the per-attack results:
  * Scans never trigger a quarantine: they are named correctly only 34% of the
    time, so the evidence is too weak to cut anyone off.
  * Only flows above a confidence bar count, because Random Forest's wrong
    names mostly sit below 0.5 confidence (paper, Table XV).
  * Charging stations and the CSMS are never quarantined, so a false alarm can
    never take the site's own infrastructure offline.
  * The level drops only after a quiet period, so it does not flicker.
"""

import json
import os
from collections import deque
from dataclasses import dataclass, field

POLICY_PATH = os.path.join(os.path.dirname(__file__), "..", "..", "frontend", "data", "containment-policy.json")
LEVELS = ("safe", "elevated", "unsafe")


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
class SiteState:
    policy: dict
    window: deque = field(default_factory=deque)
    level: str = "safe"
    calm: int = 0                       # consecutive flows below the current level
    quarantined: set = field(default_factory=set)
    recommendation: str | None = None

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

    def _recommend(self):
        q = self.policy["quarantine"]
        if self.level != "unsafe":
            return None
        counts = {}
        for o in self.window:
            if (o.flagged and o.sender and o.category in q["categories"]
                    and o.confidence is not None and o.confidence >= q["minConfidence"]
                    and o.sender not in self.policy["protected"]
                    and o.sender not in self.quarantined):
                counts[o.sender] = counts.get(o.sender, 0) + 1
        best = max(counts.items(), key=lambda kv: kv[1], default=None)
        return best[0] if best and best[1] >= q["minDetections"] else None

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
        return self.level

    def approve(self, sender):
        if sender in self.policy["protected"]:
            raise ValueError(f"{sender} is site infrastructure and cannot be quarantined")
        self.quarantined.add(sender)
        self.recommendation = None

    def release(self, sender):
        self.quarantined.discard(sender)
