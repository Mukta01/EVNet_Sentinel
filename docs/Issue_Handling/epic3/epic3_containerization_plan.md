# Epic 3: Containerization & ML Backend Deployment Strategy

## 1. Overview
The goal of Epic 3 is to containerize the trained ML models so they can serve real-time predictions to the Vercel-hosted frontend without local dependency overhead. We have chosen a REST API architecture using **FastAPI** to achieve this.

## 2. Architecture & Communication Flow
- **Frontend (Vercel/Netlify)**: Handles user UI, dashboard, and API orchestrations.
- **Backend (Docker Container on Render/AWS/etc.)**: Runs a Python environment, loads the `.pkl` models into RAM, and hosts a FastAPI server.
- **Communication**: The Frontend sends an HTTP POST request containing JSON feature data to the Backend's `/predict` endpoint. The backend processes the features through the model and returns the predicted string label.

## 3. Implementation Details
### 3.1 Dockerfile
The container uses `python:3.10-slim` to keep the image lightweight. It installs necessary production dependencies (`pandas`, `scikit-learn`, `fastapi`, `uvicorn`) via `requirements.txt` and exposes port 8000.

### 3.2 FastAPI Server (`src/api/main.py`)
- **Startup**: The server pre-loads `saved_models/svm_model_multiclass.pkl` into a global variable on boot. This ensures maximum throughput since the model is read from disk only once.
- **Endpoints**:
  - `GET /`: Health check endpoint.
  - `POST /predict`: Accepts dynamic JSON feature payloads, enforces column validation if `model.feature_names_in_` is present, converts it to a pandas DataFrame, and returns the predicted label.

## 4. Why Not Host Models on Vercel?
Vercel is optimized for frontend delivery and lightweight serverless functions (with a 50MB size limit and tight timeout restrictions). Scikit-learn and the `.pkl` files are too heavy for Vercel's serverless environment. A dedicated container registry and deployment platform (e.g., Render, Railway, AWS ECS) is the industry standard for ML Inference APIs.
