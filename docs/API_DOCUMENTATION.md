# DeepSea eDNA API - Complete Documentation

## Overview

The DeepSea eDNA API is a production-ready MLOps platform for marine taxonomic classification using deep learning on environmental DNA sequences.

**Version:** 2.0  
**Base URL:** `http://localhost:8000`  
**Documentation:** `/api/docs` (Swagger UI)

---

## Features

### ✅ Core Features
- **Machine Learning**: 94.18% accuracy on 8 marine species
- **Database Integration**: SQLAlchemy with predictions history
- **File Upload**: FASTA, FASTQ, CSV batch processing
- **Authentication**: API keys with SHA-256 hashing
- **Quality Control**: 4-tier confidence system
- **Redis Caching**: Performance optimization with fallback
- **Monitoring**: Prometheus metrics & health checks
- **Model Versioning**: Complete version management
- **A/B Testing**: Live model comparison
- **Advanced Security**: JWT authentication & RBAC
- **Data Validation**: Input validation pipeline
- **Export Formats**: BIOM, JSON, CSV, FASTA, TSV
- **Integration Tests**: Comprehensive test suite

---

## Quick Start

### 1. Authentication

```bash
# Login
POST /auth/token
Content-Type: application/x-www-form-urlencoded

username=admin&password=admin123

# Response
{
  "access_token": "eyJhbGc...",
  "refresh_token": "eyJhbGc...",
  "token_type": "bearer"
}

# Use token in requests
Authorization: Bearer eyJhbGc...
```

### 2. Make Prediction

```bash
POST /api/predict
Authorization: Bearer <token>
Content-Type: application/json

{
  "sequence": "ATCGATCGATCG",
  "use_cache": true
}
```

### 3. View Results

```bash
GET /monitoring/dashboard
Authorization: Bearer <token>
```

---

## Authentication & Authorization

### Roles

| Role | Permissions | Use Case |
|------|-------------|----------|
| **Admin** | All permissions | System administration |
| **Scientist** | Model & experiment management | ML engineers |
| **Viewer** | Read-only access | Stakeholders |
| **API User** | Predictions only | External integrations |

### Endpoints

- `POST /auth/token` - Login (OAuth2)
- `POST /auth/register` - Register user
- `GET /auth/me` - Current user info
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Logout
- `GET /auth/users` - List users
- `GET /auth/security-stats` - Security statistics

---

## Model Versioning

### Version Management

```bash
# Register version
POST /versions/register
{
  "version_name": "v2.1",
  "model_path": "./ml_models/marine_model",
  "description": "Improved accuracy",
  "metrics": {"accuracy": 0.95},
  "set_as_current": true
}

# List versions
GET /versions

# Compare versions
GET /versions/compare/{id1}/{id2}

# Rollback
POST /versions/{id}/rollback
```

---

## A/B Testing

### Create Experiment

```bash
POST /experiments/create
{
  "experiment_name": "Model v2.0 vs v2.1",
  "description": "Testing improvements",
  "variant_configs": [
    {"name": "control", "version_id": "v2.0", "traffic": 50},
    {"name": "treatment", "version_id": "v2.1", "traffic": 50}
  ],
  "strategy": "random"
}
```

### Manage Experiments

- `POST /experiments/{id}/start` - Start experiment
- `POST /experiments/{id}/stop` - Stop & declare winner
- `GET /experiments/{id}/results` - Get results
- `GET /experiments/active` - Active experiment

---

## Monitoring & Health

### System Metrics

```bash
GET /monitoring/system    # CPU, memory, disk
GET /monitoring/application  # Uptime, requests
GET /monitoring/dashboard    # All metrics
```

### Health Checks

```bash
GET /health              # Basic health
GET /health/detailed     # Component status
```

### Prometheus Metrics

```bash
GET /metrics  # Prometheus format
```

---

## Caching

```bash
GET /cache/stats          # Cache statistics
POST /cache/clear         # Clear cache
GET /cache/backend        # Backend info
```

---

## Export Formats

Supported formats:
- **JSON** - Standard API responses
- **CSV** - Tabular data
- **TSV** - Tab-separated
- **BIOM** - Biological Observation Matrix
- **FASTA** - Sequence format

---

## Error Codes

| Code | Meaning |
|------|---------|
| 200 | Success |
| 400 | Bad Request |
| 401 | Unauthorized |
| 403 | Forbidden |
| 404 | Not Found |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

---

## Rate Limiting

- Default: 100 requests/minute per user
- Configurable per API key
- Headers: `X-RateLimit-Limit`, `X-RateLimit-Remaining`

---

## Best Practices

### Security
- ✅ Use HTTPS in production
- ✅ Rotate tokens regularly
- ✅ Change default admin password
- ✅ Use environment variables for secrets
- ✅ Enable rate limiting

### Performance
- ✅ Use caching for repeated predictions
- ✅ Batch predictions when possible
- ✅ Monitor cache hit rates
- ✅ Use Redis in production

### Versioning
- ✅ Track all model versions
- ✅ Test new versions with A/B testing
- ✅ Keep rollback-ready versions
- ✅ Document changes

---

## Example Code

### Python Client

```python
import requests

class DeepSeaClient:
    def __init__(self, base_url, username, password):
        self.base_url = base_url
        self.token = None
        self.login(username, password)
    
    def login(self, username, password):
        response = requests.post(
            f"{self.base_url}/auth/token",
            data={"username": username, "password": password}
        )
        self.token = response.json()["access_token"]
    
    def predict(self, sequence):
        headers = {"Authorization": f"Bearer {self.token}"}
        response = requests.post(
            f"{self.base_url}/api/predict",
            headers=headers,
            json={"sequence": sequence}
        )
        return response.json()

# Usage
client = DeepSeaClient("http://localhost:8000", "admin", "admin123")
result = client.predict("ATCGATCGATCG")
print(result)
```

---

## Support

- **Documentation**: `/api/docs`
- **Repository**: https://github.com/jackstealer/DeepSea-eDNA
- **Issues**: GitHub Issues

---

## License

MIT License - See LICENSE file for details
