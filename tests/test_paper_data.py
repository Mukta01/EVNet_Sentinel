"""
Consistency checks on frontend/data/paper.json, the export behind the paper's
figures and the dashboard's Findings charts. Runs in CI without the dataset.
"""

import json
import os
import sys

import pytest

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from src.data_prep.preprocess import EXPECTED_CLASSES
from src.evaluation import attack_test_harness as harness
from src.evaluation import export_paper_data as paper_export

PAPER = os.path.join(os.path.dirname(__file__), "..", "frontend", "data", "paper.json")


@pytest.fixture(scope="module")
def paper():
    with open(PAPER) as handle:
        return json.load(handle)


def test_category_mapping_matches_the_harness():
    for cls in EXPECTED_CLASSES:
        assert paper_export.category(cls) == harness.category(cls), cls


def test_confusion_covers_every_class_grouped_by_category(paper):
    conf = paper["confusion"]
    assert sorted(conf["labels"]) == sorted(EXPECTED_CLASSES)
    order = [conf["categories"][l] for l in conf["labels"]]
    # Blocks are contiguous: DoS, then reconnaissance, then benign.
    assert order == sorted(order, key=["dos", "recon", "benign"].index)


def test_confusion_rows_are_normalised(paper):
    for name, model in paper["confusion"]["models"].items():
        for row, counts in zip(model["rate"], model["count"]):
            assert sum(counts) > 0, name
            assert sum(row) == pytest.approx(1.0, abs=0.01), name


def test_separability_is_a_share(paper):
    for cat, block in paper["importance"]["separability"].items():
        values = [f["value"] for f in block["features"]]
        assert all(0 <= v <= 1.05 for v in values), cat  # k-NN MI can overshoot slightly
        assert values == sorted(values, reverse=True), cat


def test_drift_events_lie_inside_the_stream(paper):
    drift = paper["drift"]
    segments = drift["segments"]
    assert segments[0]["start"] == 0 and segments[-1]["end"] == drift["instances"]
    assert all(a["end"] == b["start"] for a, b in zip(segments, segments[1:]))
    for order in ("capture", "shuffled"):
        instances = [e["instance"] for e in drift[order]["events"]]
        assert instances == sorted(instances)
        assert all(0 <= i < drift["instances"] for i in instances)
