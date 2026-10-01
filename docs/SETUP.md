# Setup Instructions

> **To start the servers, see [RUNNING.md](./RUNNING.md).** It covers the website, the prediction
> API, the demo route and troubleshooting. This page covers installing and preparing the data.

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

# Run the prediction API on the corrected models (see RUNNING.md)
make api
```
*The backend will be running at http://localhost:8000*

## 2. Docker Deployment

> **Not demo-ready yet:** the image packages the older artifacts in `saved_models/`, including a scaler
> fitted on the leaked timestamp columns. Use `make api` for now; see [RUNNING.md](./RUNNING.md).

To deploy the backend using the single-stage Docker container (which guarantees compatibility for C++/Rust extensions like `river`):

```bash
# Build the Docker image
docker build -t evnet-sentinel-api:latest .

# Run the container
docker run -p 8000:8000 evnet-sentinel-api:latest
```

## 3. Frontend Setup (Next.js)
```bash
cd frontend
npm install
cd ..
make web        # production build, http://localhost:3100 (use for demos)
make web-dev    # live reload, http://localhost:3000 (use while editing)
```
