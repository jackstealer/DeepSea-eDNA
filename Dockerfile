# Backend image for the DeepSea eDNA API
FROM python:3.11-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy requirements first (for better caching)
COPY backend/requirements.txt .

# Install CPU-only PyTorch first (the default CUDA build makes the image ~10GB)
RUN pip install --no-cache-dir torch --index-url https://download.pytorch.org/whl/cpu

# Install Python dependencies (all ship prebuilt wheels, so no compiler is needed)
RUN pip install --no-cache-dir -r requirements.txt

# Application code, MLOps modules and the trained model
COPY backend/app ./app
COPY backend/alembic.ini ./alembic.ini
COPY mlops ./mlops
COPY ml_models ./ml_models

# Run as an unprivileged user; /app/data holds the database file (SQLite mode),
# uploads and registry state, and should be mounted as a volume
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /app/data/uploads /app/data/state /app/logs \
    && chown -R appuser:appuser /app/data /app/logs
USER appuser

EXPOSE 8000

ENV PYTHONPATH=/app \
    MODEL_DIR=/app/ml_models \
    MODEL_DEVICE=cpu \
    LOG_LEVEL=INFO \
    GIT_PYTHON_REFRESH=quiet

# Health check (stdlib only); /health returns 503 when the model or database is down
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://localhost:8000/health', timeout=5)"

# Single worker: migrations run at startup and the A/B/registry state lives in process.
# --proxy-headers lets rate limiting see real client IPs behind a reverse proxy.
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1", "--proxy-headers"]
