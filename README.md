# EVNet Sentinel

An Intrusion Detection System (IDS) for Electric Vehicle Charging Station (EVCS) networks, utilizing a combination of static Machine Learning classifiers and Online Learning (ARF + ADWIN) to detect anomalous network traffic in near real-time.

This project reproduces and benchmarks the methods from Makhmudov et al. (2025) using the CICEVSE2024 dataset, and introduces a modern, interactive Next.js dashboard as an engineering and HCI contribution.

## Architecture
The system consists of two decoupled tiers:
- **Backend (Python/FastAPI):** Handles data preprocessing, model inference, online learning, and serves predictions and metrics via REST and WebSocket.
- **Frontend (Next.js/React):** A presentation layer displaying real-time alerts, animated metrics, and interactive confusion matrices.

## Setup Instructions

### 1. Backend Setup
```bash
cd backend
python3 -m venv venv
source venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```
*Backend will be running at http://localhost:8000*

### 2. Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
*Frontend will be running at http://localhost:3000*

## Team
- **Shardul Chogale** (@shard-c6) - Frontend Core & Design
- **Mukta Varak** (@Mukta01) - ML Pipeline & Data
- **Neha Chavhan** - Backend API & WebSocket
- **Shruti Chaurasiya** - Data Viz & Testing

## Project Phases
- Phase 0: Project Setup & Landing Page
- Phase 1: Backend ML Pipeline
- Phase 2: Backend API Layer
- Phase 3: Frontend Dashboard
- Phase 4: Integration & Testing
- Phase 5: Documentation & Submission

---
*Created for Software Engineering academic requirements.*
