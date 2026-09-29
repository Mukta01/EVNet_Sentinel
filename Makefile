.PHONY: data-fetch data-process data data-reference data-grouped replay-reference attack-test insights figures setup test run help

PYTHON ?= python3
RAW_DIR ?= data/raw
OUT_DIR ?= data/processed

help:
	@echo "Available commands:"
	@echo "  make data-fetch        - Download and extract the dataset from Google Drive"
	@echo "  make data-process      - Label, clean, split and scale (extended features, random split)"
	@echo "  make data              - Run data-fetch then data-process"
	@echo "  make data-reference    - Process using the reference feature set (drops ports, >80%-zeros rule)"
	@echo "  make data-grouped      - Process with whole captures held out (per-capture dedup)"
	@echo "  make replay-reference  - Replay the upstream notebook verbatim and audit the timestamp leak"
	@echo "  make attack-test       - Test every attack type against every model; fails on regression"
	@echo "  make insights          - attack-test, then rebuild the dashboard's insights bundle"
	@echo "  make figures           - rebuild paper.json, hero.json and every figure in docs/figures"
	@echo "  make setup             - Install requirements"
	@echo "  make test              - Run pytest"
	@echo "  make run               - Run FastAPI backend locally"
	@echo ""
	@echo "Override RAW_DIR / OUT_DIR to point at a different dataset copy, e.g."
	@echo "  make data-process RAW_DIR='datasets/CICEVSE2024_Dataset' OUT_DIR=data/processed_v2"

setup:
	$(PYTHON) -m pip install -r requirements.txt

data-fetch:
	$(PYTHON) src/data_prep/load_data.py

# Labels are derived from the capture filenames inside preprocess.py (issue #49),
# so this runs end-to-end from the public CIC download with no private artifact.
data-process:
	$(PYTHON) src/data_prep/preprocess.py --raw_dir "$(RAW_DIR)" --output_dir "$(OUT_DIR)" \
		--feature-set extended --split random --dedup global

data: data-fetch data-process

data-reference:
	$(PYTHON) src/data_prep/preprocess.py --raw_dir "$(RAW_DIR)" --output_dir "$(OUT_DIR)-reference" \
		--feature-set reference --split random --dedup global

# Grouped splits need per-capture dedup, otherwise a held-out capture can be
# absorbed into a training one and is not truly held out (issue #48/#50).
data-grouped:
	$(PYTHON) src/data_prep/preprocess.py --raw_dir "$(RAW_DIR)" --output_dir "$(OUT_DIR)-grouped" \
		--feature-set extended --split grouped --dedup per-capture

# Draws fresh flows each run unless SEED is set: make attack-test SEED=42
attack-test:
	$(PYTHON) src/evaluation/attack_test_harness.py $(if $(SEED),--seed $(SEED),)

insights: attack-test
	$(PYTHON) src/evaluation/export_insights.py

# Needs saved_models/multiseed and data/multiseed (run_experiments.py) plus the
# ARF drift logs; the figures then read the same JSON as the dashboard.
figures:
	$(PYTHON) src/evaluation/export_paper_data.py
	$(PYTHON) src/evaluation/export_hero_data.py
	$(PYTHON) src/evaluation/make_paper_figures.py

replay-reference:
	$(PYTHON) src/reproduction/replay_reference_preprocessing.py --audit

test:
	$(PYTHON) -m pytest tests/

run:
	uvicorn src.api.main:app --reload
