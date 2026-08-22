# Setup Instructions

## Prerequisites
- Python 3.10+
- Docker & Docker Compose (optional, for containerized deployment)
- GNU Make

## 1. Local Development (Backend)
To run the backend natively for development:

```bash
# Set up virtual environment and install dependencies
make setup

# Download and preprocess the dataset
make data

# Run the FastAPI server
uvicorn src.api.main:app --reload --port 8000
```
*The backend will be running at http://localhost:8000*

## 2. Docker Deployment (Recommended)
To deploy the backend using the single-stage Docker container (which guarantees compatibility for C++/Rust extensions like `river`):

```bash
# Build the Docker image
docker build -t evnet-sentinel-api:latest .

# Run the container
docker run -p 8000:8000 evnet-sentinel-api:latest
```

## 3. Frontend Setup (Next.js)
```bash
cd web
npm install
npm run dev
```
*The frontend will be running at http://localhost:3000*
