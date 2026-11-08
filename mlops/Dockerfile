# DeepSea eDNA Classification - Production Docker Image
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements and install Python dependencies
COPY mlops/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY mlops/main.py .
COPY mlops/database.py .
COPY mlops/crud.py .
COPY mlops/models/ ./models/

# Copy backend modules (needed for model loading)
# Note: When building, use: docker build -f mlops/Dockerfile -t deepsea-edna-api:v1.0 .
# This sets context to root, allowing access to backend/
COPY backend/__init__.py ./backend/
COPY backend/app/__init__.py ./backend/app/
COPY backend/app/core/__init__.py ./backend/app/core/
COPY backend/app/models/ ./backend/app/models/
COPY backend/app/services/ ./backend/app/services/

# Expose port
EXPOSE 8000

# Set environment variables
ENV MLFLOW_TRACKING_URI=http://host.docker.internal:5000
ENV PYTHONUNBUFFERED=1

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD python -c "import requests; requests.get('http://localhost:8000/health')"

# Start the application
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
