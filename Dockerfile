# Use single stage to avoid losing dynamically linked system libraries
FROM python:3.10-slim

WORKDIR /app

# Install build dependencies, Rust, install python packages, and then clean up build deps
COPY requirements.txt .

RUN apt-get update && apt-get install -y --no-install-recommends gcc g++ python3-dev curl && \
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y && \
    export PATH="/root/.cargo/bin:${PATH}" && \
    pip install --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt && \
    rustup self uninstall -y && \
    apt-get purge -y gcc g++ python3-dev curl && \
    apt-get autoremove -y && \
    rm -rf /var/lib/apt/lists/*

# Copy the trained models and the API source code
COPY saved_models /app/saved_models
COPY src/api /app/src/api

# Set environment variables
ENV MODELS_DIR=/app/saved_models
ENV SCALER_PATH=/app/saved_models/StandardScaler.pkl

# Expose port 8000 for the FastAPI server
EXPOSE 8000

# Run the FastAPI server using Uvicorn
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
