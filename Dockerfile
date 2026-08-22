# Use the official Python 3.10 slim image as a lightweight base
FROM python:3.10-slim

# Set working directory
WORKDIR /app

# Install system dependencies (if needed, typically none for pure python sklearn)
# RUN apt-get update && apt-get install -y --no-install-recommends gcc && rm -rf /var/lib/apt/lists/*

# Copy the requirements file and install dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the trained models and the API source code
# Note: In a real production environment, you might fetch the model from S3/cloud storage at runtime
# to keep the docker image small, but for this project, packaging it inside is fine.
COPY saved_models /app/saved_models
COPY src/api /app/src/api

# Set environment variable so the API knows where the model is
ENV MODELS_DIR=/app/saved_models
ENV SCALER_PATH=/app/saved_models/StandardScaler.pkl

# Expose port 8000 for the FastAPI server
EXPOSE 8000

# Run the FastAPI server using Uvicorn
CMD ["uvicorn", "src.api.main:app", "--host", "0.0.0.0", "--port", "8000"]
