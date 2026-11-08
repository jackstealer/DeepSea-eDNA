# Multi-stage Dockerfile for DeepSea eDNA API
FROM python:3.11-slim as base

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements first (for better caching)
COPY backend/requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend application code
COPY backend/app ./app
COPY backend/__init__.py .

# Copy MLOps modules
COPY mlops ./mlops

# Copy ML models
COPY ml_models ./ml_models

# Create necessary directories
RUN mkdir -p /app/data/uploads /app/logs

# Expose port
EXPOSE 8000

# Environment variables
ENV PYTHONPATH=/app
ENV MODEL_DIR=/app/ml_models/marine_model
ENV LOG_LEVEL=INFO

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health', timeout=5)"

# Run the application
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]
