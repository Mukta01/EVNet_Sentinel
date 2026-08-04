# EVNet Sentinel — Backend API

This directory contains the Python/FastAPI backend for EVNet Sentinel.

## Stack
- Python 3.10+
- FastAPI
- scikit-learn
- River (Online learning)

## Running locally

```bash
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
