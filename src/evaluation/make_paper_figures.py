"""
Draw the paper's figures from the same JSON the dashboard renders.

Reads frontend/data/{paper,findings,insights}.json and writes vector PDFs to
docs/figures/, which docs/EVNet_Sentinel_Findings.tex includes. Because both the
dashboard and these figures read one export, they cannot disagree.

    fig_pipeline.pdf       method at a glance
    fig_leak.pdf           published accuracy vs one leaked column vs corrected
    fig_confusion_rf.pdf   Random Forest confusion matrix, mean over seeds
    fig_separability.pdf   per-feature separability inside DoS and inside recon
    fig_drift.pdf          ADWIN alarms against capture-file seams

Usage
-----
    python3 src/evaluation/export_paper_data.py     # refresh paper.json first
    python3 src/evaluation/make_paper_figures.py
"""

import argparse
import json
import os

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import numpy as np  # noqa: E402
from matplotlib.patches import FancyArrowPatch, FancyBboxPatch, Rectangle  # noqa: E402

plt.rcParams.update({
    "font.family": "serif",
    "font.size": 8.5,
    "axes.spines.top": False,
    "axes.spines.right": False,
    "axes.linewidth": 0.6,
    "pdf.fonttype": 42,
})

DOS, RECON, BENIGN = "#6D28D9", "#B45309", "#0369A1"
GOOD, BAD, NEUTRAL = "#15803D", "#BE123C", "#475569"
FAMILY = {"volumetric": "#16A34A", "recon": "#D97706", "other": "#64748B", "benign": "#0284C7"}


def pretty(name):
    return name.replace("_", " ")


def fig_pipeline(findings, insights, out):
    ds, seeds, cfg = findings["dataset"], findings["seeds"], insights["config"]
    stages = [
        ("Capture", "CICEVSE2024\ntwo stations", f"{ds['n_classes']} classes"),
        ("Remove leakage", "drop timestamps\n+ src_port", f"{ds['rows_after_dedup']:,} flows"),
        ("Split", "70/15/15\nstratified", f"{len(seeds)} seeds"),
        ("Detect", "4 static models\n+ ARF/ADWIN", f"{ds['n_features']} features"),
        ("Test per attack", "detected,\ncategory, named", f"{cfg['trials']}x{cfg['batch']} flows"),
        ("Respond", "owner, CSMS,\nanalyst", "14 attack types"),
    ]
    fig, ax = plt.subplots(figsize=(7.0, 1.35))
    ax.set_xlim(0, len(stages))
    ax.set_ylim(0, 1)
    ax.axis("off")
    for i, (title, body, number) in enumerate(stages):
        ax.add_patch(FancyBboxPatch((i + 0.06, 0.06), 0.8, 0.88, boxstyle="round,pad=0,rounding_size=0.04",
                                    fc="#F8FAFC", ec="#94A3B8", lw=0.6))
        ax.text(i + 0.46, 0.8, title, ha="center", va="center", fontweight="bold", fontsize=7.4)
        ax.text(i + 0.46, 0.5, body, ha="center", va="center", fontsize=6.2, color="#334155", linespacing=1.3)
        ax.text(i + 0.46, 0.17, number, ha="center", va="center", fontsize=6.2, color=NEUTRAL)
        if i < len(stages) - 1:
            ax.add_patch(FancyArrowPatch((i + 0.87, 0.5), (i + 1.05, 0.5), arrowstyle="-|>",
                                         mutation_scale=7, color="#64748B", lw=0.7))
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)


def fig_leak(findings, out):
    rf = next(m for m in findings["models"] if m["name"] == "RandomForest")
    rows = [
        ("Paper reports", findings["paperReported"]["accuracy"], NEUTRAL),
        ("One timestamp\ncolumn alone", findings["singleColumnProbe"][0]["accuracy"], BAD),
        ("Leak removed\n(Random Forest)", rf["accuracy"], GOOD),
    ]
    fig, ax = plt.subplots(figsize=(3.4, 1.7))
    y = np.arange(len(rows))[::-1]
    ax.barh(y, [r[1] for r in rows], color=[r[2] for r in rows], height=0.55)
    for yi, (_, v, _) in zip(y, rows):
        ax.text(v + 0.01, yi, f"{v:.1%}", va="center", fontsize=8)
    ax.set_yticks(y, [r[0] for r in rows])
    ax.set_xlim(0, 1.12)
    ax.set_xlabel("multiclass accuracy")
    ax.text(rf["accuracy"] / 2, y[-1], f"macro-F1 {rf['macro_f1']:.3f}", ha="center", va="center",
            color="white", fontsize=7)
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)


def fig_confusion(paper, out, model="RandomForest"):
    conf = paper["confusion"]
    labels, cats = conf["labels"], conf["categories"]
    rate = np.array(conf["models"][model]["rate"])
    n = len(labels)
    fig, ax = plt.subplots(figsize=(4.9, 4.4))
    rgba = np.zeros((n, n, 4))
    for i in range(n):
        for j in range(n):
            v = rate[i, j]
            if i == j:
                rgba[i, j] = (*matplotlib.colors.to_rgb(GOOD), 0.08 + 0.92 * v)
            elif v > 0:
                rgba[i, j] = (*matplotlib.colors.to_rgb(BAD), min(1.0, 0.1 + 3 * v))
    ax.imshow(rgba, interpolation="nearest")
    for i in range(n):
        for j in range(n):
            if rate[i, j] >= 0.05:
                ax.text(j, i, f"{rate[i, j] * 100:.0f}", ha="center", va="center", fontsize=5.6,
                        color="white" if (i == j and rate[i, j] > 0.5) or (i != j and rate[i, j] > 0.25) else "black")
    edges = [i for i in range(1, n) if cats[labels[i]] != cats[labels[i - 1]]]
    for e in edges:
        ax.axhline(e - 0.5, color="#0F172A", lw=0.6, ls="--")
        ax.axvline(e - 0.5, color="#0F172A", lw=0.6, ls="--")
    ax.set_xticks(range(n), [pretty(l) for l in labels], rotation=60, ha="right", fontsize=6.3)
    ax.set_yticks(range(n), [pretty(l) for l in labels], fontsize=6.3)
    for tick, label in zip(ax.get_yticklabels(), labels):
        tick.set_color({"dos": DOS, "recon": RECON, "benign": BENIGN}[cats[label]])
    for tick, label in zip(ax.get_xticklabels(), labels):
        tick.set_color({"dos": DOS, "recon": RECON, "benign": BENIGN}[cats[label]])
    ax.set_xlabel("predicted")
    ax.set_ylabel("true")
    ax.tick_params(length=0)
    for s in ax.spines.values():
        s.set_visible(False)
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)


def fig_separability(paper, out, top=8):
    sep = paper["importance"]["separability"]
    fig, axes = plt.subplots(1, 2, figsize=(7.0, 2.2), sharex=True)
    for ax, key, title, color in [(axes[0], "dos", "Naming a denial-of-service attack", DOS),
                                  (axes[1], "recon", "Naming a scan", RECON)]:
        feats = sep[key]["features"][:top]
        y = np.arange(len(feats))[::-1]
        ax.barh(y, [f["value"] for f in feats], color=color, height=0.62)
        for yi, f in zip(y, feats):
            ax.text(f["value"] + 0.015, yi, f"{f['value']:.0%}" if f["value"] >= 0.1 else f"{f['value']:.1%}",
                    va="center", fontsize=6.5)
        ax.set_yticks(y, [f["feature"] for f in feats], fontsize=6.3, family="monospace")
        ax.set_title(f"{title}\n({sep[key]['rows']:,} flows, {sep[key]['classes']} classes)", fontsize=8)
        ax.set_xlim(0, 1.1)
        ax.xaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
        ax.tick_params(axis="y", length=0)
    fig.supxlabel("share of label uncertainty resolved by the feature alone (MI / H)", fontsize=7.5)
    fig.tight_layout()
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)


def fig_drift(paper, findings, out):
    drift = paper["drift"]
    groups = {r["class"]: r["group"] for r in findings["perClass"]}
    total = drift["instances"]
    fig, (band, ax) = plt.subplots(2, 1, figsize=(7.0, 2.5), sharex=True,
                                   gridspec_kw={"height_ratios": [1, 6], "hspace": 0.08})
    for s in drift["segments"]:
        fam = "benign" if s["label"] == "Benign" else groups.get(s["label"], "other")
        band.add_patch(Rectangle((s["start"], 0), s["end"] - s["start"], 1, color=FAMILY[fam], lw=0))
    band.set_ylim(0, 1)
    band.axis("off")
    band.set_title("capture files in stream order", fontsize=7, loc="left", color=NEUTRAL)
    for s in drift["segments"][1:]:
        ax.axvline(s["start"], color="#CBD5E1", lw=0.4, ls=(0, (2, 2)), zorder=0)
    for key, color, name in [("capture", GOOD, "Capture order"), ("shuffled", "#7C3AED", "Shuffled")]:
        run = drift[key]
        xs = [e["instance"] for e in run["events"]] + [total]
        ys = [e["accuracy"] for e in run["events"]] + [run["accuracy"]]
        ax.plot(xs, ys, color=color, lw=0.9, alpha=0.6)
        ax.scatter(xs[:-1], ys[:-1], s=9, color=color, zorder=3,
                   label=f"{name}: {len(run['events'])} alarms, final accuracy {run['accuracy']:.2%}")
    ax.set_ylim(0.3, 1.04)
    ax.set_xlim(0, total)
    ax.set_ylabel("running accuracy")
    ax.set_xlabel("flows in stream")
    ax.set_xticks([0, 0.5e6, 1e6, 1.5e6], ["0", "0.5M", "1.0M", "1.5M"])
    ax.yaxis.set_major_formatter(matplotlib.ticker.PercentFormatter(1.0))
    ax.legend(loc="center right", fontsize=6.8, frameon=False)
    fig.savefig(out, bbox_inches="tight")
    plt.close(fig)


def main():
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--data", default="frontend/data")
    parser.add_argument("--out", default="docs/figures")
    args = parser.parse_args()

    load = lambda name: json.load(open(os.path.join(args.data, name)))  # noqa: E731
    paper, findings, insights = load("paper.json"), load("findings.json"), load("insights.json")
    os.makedirs(args.out, exist_ok=True)
    jobs = {
        "fig_pipeline.pdf": lambda p: fig_pipeline(findings, insights, p),
        "fig_leak.pdf": lambda p: fig_leak(findings, p),
        "fig_confusion_rf.pdf": lambda p: fig_confusion(paper, p),
        "fig_separability.pdf": lambda p: fig_separability(paper, p),
        "fig_drift.pdf": lambda p: fig_drift(paper, findings, p),
    }
    for name, draw in jobs.items():
        path = os.path.join(args.out, name)
        draw(path)
        print(f"[+] {path}")


if __name__ == "__main__":
    main()
