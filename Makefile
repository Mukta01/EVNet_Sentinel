.PHONY: data-fetch data-process data setup test run help

help:
	@echo "Available commands:"
	@echo "  make data-fetch   - Download and extract the dataset from Google Drive"
	@echo "  make data-process - Clean, engineer, scale, and split the data"
	@echo "  make data         - Run data-fetch and then data-process"
	@echo "  make setup        - Install requirements"
	@echo "  make test         - Run pytest"
	@echo "  make run          - Run FastAPI backend locally"

setup:
	pip install -r requirements.txt

data-fetch:
	python src/data_prep/load_data.py

data-process:
	python src/data_prep/preprocess.py

data: data-fetch data-process

test:
	python -m pytest tests/

run:
	uvicorn src.api.main:app --reload
