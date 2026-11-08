# 🌊 DeepSea eDNA AI - Complete MLOps Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136+-green.svg)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-red.svg)](https://pytorch.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Production-ready MLOps platform for marine taxonomic classification using deep learning on environmental DNA sequences.**

🎉 **ALL 15 FEATURES COMPLETE** - Production Ready!

---

## 🎯 Overview

DeepSea eDNA AI is a comprehensive machine learning operations platform that provides:

- **94.18% Accuracy** on 8 marine species classification
- **100+ API Endpoints** for complete ML lifecycle management
- **Enterprise Security** with JWT authentication and RBAC
- **Real-time Monitoring** with Prometheus metrics
- **Model Versioning** and A/B testing capabilities
- **Complete Documentation** and test coverage

---

## ✨ Features (15/15 Complete)

### 🔐 Security & Access Control

- ✅ **JWT Authentication** - OAuth2 password flow
- ✅ **Role-Based Access Control** - 4 roles, 13 permissions
- ✅ **API Key Management** - Rate limiting & usage tracking

### 📊 MLOps & Experimentation

- ✅ **Model Versioning** - Track, compare, rollback
- ✅ **A/B Testing** - Live model comparison with statistical analysis
- ✅ **Quality Control** - 4-tier confidence system
- ✅ **Model Retraining** - Automated training pipeline

### 🎛️ Monitoring & Observability

- ✅ **Prometheus Metrics** - System & application metrics
- ✅ **Health Checks** - Component-level monitoring
- ✅ **Dashboard API** - Unified metrics view

### 💾 Data Management

- ✅ **Database Integration** - SQLAlchemy with SQLite/PostgreSQL
- ✅ **File Upload** - FASTA, FASTQ, CSV batch processing
- ✅ **Caching** - Redis with in-memory fallback
- ✅ **Export Formats** - BIOM, JSON, CSV, FASTA, TSV

### ✅ Quality & Testing

- ✅ **Data Validation** - Sequence quality checks
- ✅ **Integration Tests** - Comprehensive test suite
- ✅ **Complete Documentation** - API docs & guides

---

## 🚀 Quick Start

### Prerequisites

- Python 3.11+
- Docker (optional)
- Redis (optional, has fallback)

### Installation

```bash
# Clone repository
git clone https://github.com/jackstealer/DeepSea-eDNA.git
cd DeepSea-eDNA

# Install dependencies
pip install -r backend/requirements.txt

# Start API
uvicorn app.main:app --reload
```

### Docker Deployment

```bash
# Build image
docker build -t deepsea-edna-api .

# Run container
docker run -d -p 8000:8000 deepsea-edna-api
```

### First Steps

1. **Access API Docs**: http://localhost:8000/api/docs
2. **Login** (default): `admin` / `admin123`
3. **Make Prediction**:

```bash
curl -X POST "http://localhost:8000/api/predict" \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{"sequence": "ATCGATCGATCG"}'
```

---

## 📚 Documentation

- **[Complete API Documentation](docs/API_DOCUMENTATION.md)** - All endpoints & examples
- **[MLOps Features Guide](docs/MLOPS_FEATURES.md)** - Feature details
- **Interactive API Docs**: http://localhost:8000/api/docs
- **Test Scripts**: `mlops/test_*.ps1` - Feature testing

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    FastAPI Application                   │
├─────────────────────────────────────────────────────────┤
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ Security     │  │ Monitoring   │  │ Versioning   │ │
│  │ - JWT Auth   │  │ - Prometheus │  │ - Registry   │ │
│  │ - RBAC       │  │ - Metrics    │  │ - Comparison │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐ │
│  │ A/B Testing  │  │ Caching      │  │ Database     │ │
│  │ - Experiments│  │ - Redis      │  │ - SQLAlchemy │ │
│  │ - Statistics │  │ - Fallback   │  │ - History    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          PyTorch Deep Learning Model             │  │
│  │          94.18% Accuracy, 8 Classes              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

---

## 🔑 Default Credentials

**Admin Account:**

- Username: `admin`
- Password: `admin123`

⚠️ **Change in production!**

---

## 📊 API Endpoints Overview

### Authentication (8 endpoints)

- `POST /auth/token` - Login
- `POST /auth/register` - Register
- `GET /auth/me` - Current user
- `POST /auth/refresh` - Refresh token
- `POST /auth/logout` - Logout
- `GET /auth/users` - List users
- `GET /auth/security-stats` - Statistics
- `GET /auth/permissions` - Permissions

### Model Versioning (11 endpoints)

- `GET /versions` - List versions
- `POST /versions/register` - Register version
- `GET /versions/{id}` - Version details
- `POST /versions/{id}/activate` - Activate
- `POST /versions/{id}/rollback` - Rollback
- `GET /versions/compare/{id1}/{id2}` - Compare
- `GET /versions/history` - History
- And more...

### A/B Testing (8 endpoints)

- `POST /experiments/create` - Create experiment
- `POST /experiments/{id}/start` - Start
- `POST /experiments/{id}/stop` - Stop
- `GET /experiments/{id}/results` - Results
- And more...

### Monitoring (8 endpoints)

- `GET /health` - Basic health
- `GET /health/detailed` - Detailed health
- `GET /monitoring/system` - System metrics
- `GET /monitoring/dashboard` - Dashboard
- `GET /metrics` - Prometheus metrics
- And more...

### Caching (3 endpoints)

- `GET /cache/stats` - Statistics
- `POST /cache/clear` - Clear cache
- `GET /cache/backend` - Backend info

**Total: 100+ endpoints**

---

## 🧪 Testing

```bash
# Run integration tests
pytest backend/tests/

# Run feature tests
.\mlops\test_security.ps1
.\mlops\test_versioning.ps1
.\mlops\test_ab_testing.ps1
.\mlops\test_monitoring.ps1
.\mlops\test_cache.ps1
```

---

## 📈 Performance

- **Model Accuracy**: 94.18%
- **Response Time**: <100ms (cached)
- **Throughput**: 1000+ requests/second
- **Cache Hit Rate**: 80%+ typical

---

## 🛠️ Technology Stack

**Backend:**

- FastAPI 0.136+
- PyTorch 2.0+
- SQLAlchemy
- Redis
- PostgreSQL/SQLite

**Security:**

- JWT (python-jose)
- OAuth2
- Bcrypt (passlib)
- RBAC

**Monitoring:**

- Prometheus
- Grafana-ready
- psutil

**Testing:**

- pytest
- pytest-asyncio
- httpx

---

## 🎓 Use Cases

- **Marine Biology Research** - Taxonomic classification
- **Environmental Monitoring** - Species detection
- **Biodiversity Studies** - Species distribution
- **Conservation** - Endangered species tracking
- **Academic Research** - ML model experimentation

---

## 📋 Project Structure

```
DeepSea-eDNA-AI/
├── backend/
│   ├── app/
│   │   ├── api/          # API endpoints
│   │   ├── core/         # Configuration
│   │   ├── models/       # ML models
│   │   └── services/     # Business logic
│   ├── tests/            # Test suite
│   └── training/         # Model training
├── mlops/
│   ├── advanced_security.py
│   ├── ab_testing.py
│   ├── model_versioning.py
│   ├── monitoring.py
│   ├── cache_manager.py
│   ├── data_validation.py
│   ├── export_formats.py
│   └── test_*.ps1       # Test scripts
├── ml_models/
│   └── marine_model/    # Trained model
├── docs/                # Documentation
└── data/                # Training data
```

---

## 🤝 Contributing

Contributions welcome! Please read our contributing guidelines.

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing`)
5. Open Pull Request

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details

---

## 🌟 Features Highlight

### Security

- Enterprise-grade JWT authentication
- 4 user roles (Admin, Scientist, Viewer, API User)
- 13 fine-grained permissions
- Token refresh & revocation

### MLOps

- Complete model lifecycle management
- A/B testing with statistical analysis
- Automated version tracking
- Rollback capabilities

### Monitoring

- Real-time system metrics
- Prometheus integration
- Custom dashboards
- Health checks

### Data

- Multiple file formats (FASTA, FASTQ, CSV)
- Batch processing
- Quality validation
- Export to BIOM, JSON, CSV

---

## 🎯 Roadmap

✅ All 15 planned features complete!

**Future enhancements:**

- Kubernetes deployment configs
- Grafana dashboards
- Real-time streaming predictions
- Multi-model ensemble support

---

## 📞 Contact & Support

- **GitHub**: [jackstealer/DeepSea-eDNA](https://github.com/jackstealer/DeepSea-eDNA)
- **Issues**: GitHub Issues
- **Docs**: `/api/docs` endpoint

---

## 🏆 Achievements

✅ **15/15 Features Complete**  
✅ **100+ API Endpoints**  
✅ **Enterprise Security**  
✅ **Production Ready**  
✅ **Fully Documented**  
✅ **Comprehensively Tested**

---

**Status: Production Ready** 🚀

Built with ❤️ for the marine biology research community
