# 🐳 DeepSea eDNA AI - Docker Package

## Quick Start

Pull and run the latest Docker image from GitHub Container Registry:

```bash
# Pull the latest image
docker pull ghcr.io/jackstealer/deepsea-edna:latest

# Run the container
docker run -d \
  --name deepsea-edna \
  -p 8000:8000 \
  -e SECRET_KEY=your-secret-key \
  ghcr.io/jackstealer/deepsea-edna:latest
```

Access the API at: http://localhost:8000

---

## 📦 Available Tags

| Tag | Description | Command |
|-----|-------------|---------|
| `latest` | Latest stable build from main branch | `docker pull ghcr.io/jackstealer/deepsea-edna:latest` |
| `main` | Latest build from main branch | `docker pull ghcr.io/jackstealer/deepsea-edna:main` |
| `develop` | Development branch builds | `docker pull ghcr.io/jackstealer/deepsea-edna:develop` |
| `v1.0.0` | Specific version (semver) | `docker pull ghcr.io/jackstealer/deepsea-edna:v1.0.0` |
| `main-abc1234` | Specific commit SHA | `docker pull ghcr.io/jackstealer/deepsea-edna:main-abc1234` |

---

## 🚀 Usage Examples

### Basic Usage

```bash
# Pull and run in one command
docker run -d -p 8000:8000 ghcr.io/jackstealer/deepsea-edna:latest

# View logs
docker logs -f deepsea-edna

# Stop container
docker stop deepsea-edna

# Remove container
docker rm deepsea-edna
```

### Production Deployment

```bash
# Run with environment variables
docker run -d \
  --name deepsea-edna-prod \
  -p 8000:8000 \
  -e ENVIRONMENT=production \
  -e SECRET_KEY=your-secret-key-here \
  -e DATABASE_URL=postgresql://user:pass@db:5432/deepsea \
  -e REDIS_URL=redis://redis:6379/0 \
  -e MODEL_DIR=/app/ml_models \
  -e LOG_LEVEL=INFO \
  -v /path/to/models:/app/ml_models \
  --restart unless-stopped \
  ghcr.io/jackstealer/deepsea-edna:latest
```

### Development with Volume Mounting

```bash
# Mount local code for development
docker run -d \
  --name deepsea-edna-dev \
  -p 8000:8000 \
  -v $(pwd)/ml_models:/app/ml_models \
  -v $(pwd)/data:/app/data \
  -e ENVIRONMENT=development \
  -e DEBUG=true \
  ghcr.io/jackstealer/deepsea-edna:latest
```

### Using Docker Compose

Create a `docker-compose.yml`:

```yaml
version: '3.8'

services:
  api:
    image: ghcr.io/jackstealer/deepsea-edna:latest
    ports:
      - "8000:8000"
    environment:
      - ENVIRONMENT=production
      - SECRET_KEY=${SECRET_KEY}
      - DATABASE_URL=postgresql://postgres:password@db:5432/deepsea
      - REDIS_URL=redis://redis:6379/0
    depends_on:
      - db
      - redis
    restart: unless-stopped

  db:
    image: postgres:15-alpine
    environment:
      - POSTGRES_DB=deepsea
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=password
    volumes:
      - postgres_data:/var/lib/postgresql/data
    restart: unless-stopped

  redis:
    image: redis:7-alpine
    restart: unless-stopped

volumes:
  postgres_data:
```

Run with:

```bash
docker-compose up -d
```

---

## 🔧 Configuration

### Environment Variables

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `SECRET_KEY` | Secret key for JWT tokens | - | ✅ Yes |
| `ENVIRONMENT` | Environment (development/production) | `development` | No |
| `DATABASE_URL` | PostgreSQL connection string | SQLite (dev only) | Production |
| `REDIS_URL` | Redis connection string | In-memory cache | No |
| `MODEL_DIR` | Directory for ML models | `/app/ml_models` | No |
| `DEFAULT_MODEL` | Default model to load | `marine_model` | No |
| `MODEL_DEVICE` | Device for inference (cpu/cuda) | `cpu` | No |
| `LOG_LEVEL` | Logging level | `INFO` | No |
| `CORS_ORIGINS` | Allowed CORS origins | `*` | No |
| `HOST` | Server host | `0.0.0.0` | No |
| `PORT` | Server port | `8000` | No |

### Volume Mounts

| Host Path | Container Path | Purpose |
|-----------|---------------|---------|
| `./ml_models` | `/app/ml_models` | ML model files |
| `./data` | `/app/data` | Training data |
| `./logs` | `/app/logs` | Application logs |

---

## 🏗️ Building Your Own Image

### From Source

```bash
# Clone repository
git clone https://github.com/jackstealer/DeepSea-eDNA.git
cd DeepSea-eDNA

# Build image
docker build -t deepsea-edna:custom .

# Run your custom build
docker run -d -p 8000:8000 deepsea-edna:custom
```

### Multi-stage Build

The Dockerfile uses multi-stage builds for optimization:

1. **Builder stage**: Installs dependencies
2. **Final stage**: Minimal runtime image

To rebuild with custom dependencies:

```bash
# Edit requirements.txt
# Rebuild
docker build --no-cache -t deepsea-edna:custom .
```

---

## 📊 Health Checks

The container includes built-in health checks:

```bash
# Check container health
docker inspect --format='{{.State.Health.Status}}' deepsea-edna

# Manual health check
curl http://localhost:8000/health

# Detailed health check
curl http://localhost:8000/health/detailed
```

Expected response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "cache_backend": "redis"
}
```

---

## 🔍 Troubleshooting

### View Logs

```bash
# Real-time logs
docker logs -f deepsea-edna

# Last 100 lines
docker logs --tail 100 deepsea-edna

# Logs since 10 minutes ago
docker logs --since 10m deepsea-edna
```

### Interactive Shell

```bash
# Access container shell
docker exec -it deepsea-edna /bin/bash

# Check Python environment
docker exec -it deepsea-edna python --version

# List files
docker exec -it deepsea-edna ls -la /app
```

### Common Issues

#### Port Already in Use
```bash
# Check what's using port 8000
netstat -ano | findstr :8000

# Use different port
docker run -d -p 8080:8000 ghcr.io/jackstealer/deepsea-edna:latest
```

#### Model Not Loading
```bash
# Mount models directory
docker run -d \
  -p 8000:8000 \
  -v /path/to/ml_models:/app/ml_models \
  ghcr.io/jackstealer/deepsea-edna:latest
```

#### Permission Issues
```bash
# Run with specific user
docker run -d \
  -p 8000:8000 \
  --user 1000:1000 \
  ghcr.io/jackstealer/deepsea-edna:latest
```

---

## 🌐 Network Configuration

### Bridge Network (Default)

```bash
# Default bridge network
docker run -d --name deepsea-edna -p 8000:8000 \
  ghcr.io/jackstealer/deepsea-edna:latest
```

### Custom Network

```bash
# Create network
docker network create deepsea-network

# Run containers on same network
docker run -d --name redis --network deepsea-network redis:7-alpine
docker run -d --name postgres --network deepsea-network postgres:15-alpine

docker run -d \
  --name deepsea-edna \
  --network deepsea-network \
  -p 8000:8000 \
  -e REDIS_URL=redis://redis:6379/0 \
  -e DATABASE_URL=postgresql://postgres:password@postgres:5432/deepsea \
  ghcr.io/jackstealer/deepsea-edna:latest
```

### Host Network

```bash
# Use host network (Linux only)
docker run -d \
  --name deepsea-edna \
  --network host \
  ghcr.io/jackstealer/deepsea-edna:latest
```

---

## 📈 Monitoring

### Prometheus Metrics

```bash
# Access metrics endpoint
curl http://localhost:8000/metrics

# Run Prometheus
docker run -d \
  --name prometheus \
  -p 9090:9090 \
  -v $(pwd)/prometheus.yml:/etc/prometheus/prometheus.yml \
  prom/prometheus
```

Example `prometheus.yml`:
```yaml
global:
  scrape_interval: 15s

scrape_configs:
  - job_name: 'deepsea-edna'
    static_configs:
      - targets: ['host.docker.internal:8000']
```

### Grafana Dashboard

```bash
# Run Grafana
docker run -d \
  --name grafana \
  -p 3000:3000 \
  grafana/grafana
```

---

## 🔐 Security Best Practices

### 1. Use Secrets

```bash
# Create secret file
echo "my-secret-key" > secret.txt

# Use with Docker secrets (Swarm mode)
docker secret create deepsea_secret secret.txt

# Or use environment file
echo "SECRET_KEY=my-secret-key" > .env
docker run -d --env-file .env ghcr.io/jackstealer/deepsea-edna:latest
```

### 2. Run as Non-Root

The Docker image already runs as non-root user by default.

### 3. Read-Only Filesystem

```bash
docker run -d \
  --read-only \
  --tmpfs /tmp \
  -p 8000:8000 \
  ghcr.io/jackstealer/deepsea-edna:latest
```

### 4. Resource Limits

```bash
docker run -d \
  --name deepsea-edna \
  -p 8000:8000 \
  --memory="2g" \
  --cpus="2.0" \
  ghcr.io/jackstealer/deepsea-edna:latest
```

---

## 🚢 CI/CD Integration

### GitHub Actions

The image is automatically built and published on every push to `main`:

- **Trigger**: Push to main branch
- **Registry**: GitHub Container Registry (ghcr.io)
- **Tags**: `latest`, `main`, SHA-based tags
- **Workflow**: `.github/workflows/docker-build.yml`

### Pull in Other Workflows

```yaml
jobs:
  test:
    runs-on: ubuntu-latest
    container:
      image: ghcr.io/jackstealer/deepsea-edna:latest
    steps:
      - name: Run tests
        run: pytest
```

### Kubernetes Deployment

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: deepsea-edna
spec:
  replicas: 3
  selector:
    matchLabels:
      app: deepsea-edna
  template:
    metadata:
      labels:
        app: deepsea-edna
    spec:
      containers:
      - name: api
        image: ghcr.io/jackstealer/deepsea-edna:latest
        ports:
        - containerPort: 8000
        env:
        - name: SECRET_KEY
          valueFrom:
            secretKeyRef:
              name: deepsea-secrets
              key: secret-key
```

---

## 📦 Package Information

- **Registry**: GitHub Container Registry (ghcr.io)
- **Repository**: jackstealer/deepsea-edna
- **Size**: ~800MB (optimized multi-stage build)
- **Base Image**: python:3.11-slim
- **Platforms**: linux/amd64
- **Automated Builds**: Yes (GitHub Actions)

---

## 📚 Additional Resources

- **Documentation**: https://github.com/jackstealer/DeepSea-eDNA
- **API Docs**: http://localhost:8000/api/docs (when running)
- **Issues**: https://github.com/jackstealer/DeepSea-eDNA/issues
- **Packages**: https://github.com/jackstealer/DeepSea-eDNA/pkgs/container/deepsea-edna

---

## 🤝 Contributing

To contribute a new Docker feature:

1. Fork the repository
2. Modify the Dockerfile
3. Test locally: `docker build -t test .`
4. Submit a pull request
5. The image will auto-build on merge

---

**Generated:** 2026-11-08
**Version:** 1.0
**License:** MIT
