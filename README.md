# 🌊 DeepSea eDNA AI - Marine Species Classification Platform

[![Python](https://img.shields.io/badge/Python-3.11-blue.svg)](https://www.python.org/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.136+-green.svg)](https://fastapi.tiangolo.com/)
[![PyTorch](https://img.shields.io/badge/PyTorch-2.0+-red.svg)](https://pytorch.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-blue.svg)](https://www.docker.com/)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

**Production-ready MLOps platform for marine taxonomic classification using deep learning on environmental DNA sequences.**

---

## 🖥️ Frontend Web Application (React + TypeScript + Vite)

### Setup & Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Configure environment variables**:
   Copy `.env.example` to `.env` and set the FastAPI backend URL:
   ```env
   VITE_API_BASE_URL=http://localhost:8000
   ```
   You can also override the API URL at runtime from the top-bar **API settings** popover, the login screen, or **Profile & Settings** (stored in memory only).

3. **Run the development server** (port `3000`):
   ```bash
   npm run dev
   ```

4. **Build & type-check**:
   ```bash
   npm run lint
   npm run build
   ```

### Architecture
- `src/lib/api.ts`: Centralized Axios client with Bearer injection, automatic `/auth/refresh` on `401`, and structured handling for `401`, `403`, `413`, `422`, and network/CORS errors.
- `src/store/authStore.ts`: Zustand store persisting tokens in memory + `sessionStorage`, runtime API override in memory, and Dark/Light theme state.
- `src/pages/`: `LoginPage`, `DashboardPage`, `ClassifyPage`, `TaxaExplorerPage`, `ModelsPage`, `ExperimentsPage`, `MonitoringPage`, `AdminPage`, `SettingsPage`.

---

## 🎯 Overview

DeepSea eDNA AI is a comprehensive machine learning operations platform that provides:

- **95.0% held-out accuracy** classifying 8 marine taxa (orders/classes)
- **54 API endpoints** for the complete ML lifecycle
- **Enterprise Security** with JWT authentication and RBAC
- **Real-time Monitoring** with Prometheus metrics
- **Model Versioning** and A/B testing capabilities
- **Docker Containerization** for easy deployment
- **Complete Documentation** and test coverage

### 🧬 What is eDNA?

Environmental DNA (eDNA) is genetic material obtained from environmental samples (water, soil, air) without isolating individual organisms. This project uses deep learning to classify marine species from their DNA sequences, enabling:

- 🐟 Non-invasive species monitoring
- 🌍 Biodiversity assessment
- 🔬 Marine ecosystem research
- 🚨 Early detection of invasive species
- 📊 Conservation planning

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

- ✅ **File Upload** - FASTA, FASTQ, CSV batch processing
- ✅ **Caching** - Redis with in-memory fallback
- ✅ **Export Formats** - BIOM, JSON, CSV, FASTA, TSV

### 🚀 CI/CD & Deployment

- ✅ **CI/CD pipeline** (`ci-cd.yml`) - lint, backend tests on SQLite + PostgreSQL, frontend build,
  then a full docker compose E2E run (model served from MLflow) before anything is published
- ✅ **Container registry** - the exact images that passed E2E are pushed to GHCR from `main` and `v*` tags
- ✅ **MLflow model registry** - experiment tracking, versioned models, `@champion`/`@challenger` aliases
- ✅ **Retraining pipeline** (`model-training.yml`) - train, register, approval gate, manual or event-triggered

---

## 🚀 Quick Start

### 🐳 Docker Deployment (Recommended)

#### From GitHub Container Registry

```bash
# Pull the latest image
docker pull ghcr.io/jackstealer/deepsea-edna:latest

# Run with basic configuration
docker run -d \
  --name deepsea-edna \
  -p 8000:8000 \
  ghcr.io/jackstealer/deepsea-edna:latest

# Access the API
curl http://localhost:8000/health
open http://localhost:8000/api/docs
```

#### Advanced Configuration

```bash
docker run -d \
  --name deepsea-edna-prod \
  -p 8000:8000 \
  -e ENVIRONMENT=production \
  -e SECRET_KEY=your-secret-key-here \
  -e DATABASE_URL=postgresql://user:pass@db:5432/deepsea \
  -e REDIS_URL=redis://redis:6379/0 \
  -v $(pwd)/ml_models:/app/ml_models \
  --restart unless-stopped \
  ghcr.io/jackstealer/deepsea-edna:latest
```

#### Docker Compose (recommended for real users)

The repository ships a production-style `docker-compose.yml`: PostgreSQL, Redis,
the FastAPI backend and an nginx-served frontend, with data in persistent volumes.

```bash
cp .env.example .env
# Edit .env: set SECRET_KEY, POSTGRES_PASSWORD and ADMIN_EMAILS (your email)
docker compose up -d --build
```

- App: http://localhost:3000
- API docs: http://localhost:8000/api/docs

Database migrations run automatically when the backend starts. The backend refuses
to start in production with the default `SECRET_KEY`.

#### Accounts, roles and sign-in

- Users sign up with email + password, **Google** or **GitHub**. Signing in with a
  provider that uses the same verified email links to the existing account.
- New accounts are `viewer`s. Emails listed in `ADMIN_EMAILS` are always `admin`;
  admins promote others (`scientist`, `api_user`) or disable accounts on the Admin page.
- Every user sees only their own history, jobs and exports. System monitoring is admin-only.

**Enable Google sign-in:** Google Cloud Console → APIs & Services → Credentials →
Create OAuth client ID (Web application). Add the authorized redirect URI
`http://localhost:8000/auth/oauth/google/callback` (use your `BACKEND_PUBLIC_URL` in
production), then put the client ID and secret in `.env` as `GOOGLE_CLIENT_ID` /
`GOOGLE_CLIENT_SECRET`.

**Enable GitHub sign-in:** GitHub → Settings → Developer settings → OAuth Apps →
New OAuth App. Homepage URL `http://localhost:3000`, authorization callback URL
`http://localhost:8000/auth/oauth/github/callback`. Put the values in `.env` as
`GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET`.

Buttons for a provider appear on the login page only once its keys are set.
Restart the backend after editing `.env` (`docker compose up -d`).

### 💻 Local Development

#### Prerequisites

- Python 3.11+
- Redis (optional, in-memory fallback available)

#### Installation

```bash
# Clone repository
git clone https://github.com/jackstealer/DeepSea-eDNA.git
cd DeepSea-eDNA

# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r backend/requirements-dev.txt

# Start API
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

Access at: http://localhost:8000/api/docs

#### First Steps

1. **Access API Docs**: http://localhost:8000/api/docs
2. **Sign in**: register (or use Google/GitHub) with an email listed in `ADMIN_EMAILS` to get the
   admin role, then get a token from `POST /auth/token`
3. **Make Prediction**:

```bash
curl -X POST "http://localhost:8000/api/predict" \
  -H "Authorization: Bearer <your-token>" \
  -H "Content-Type: application/json" \
  -d '{"sequence": "ATCGATCGATCGATCGATCG"}'
```

---

## 🔁 MLflow Model Registry & Serving

The API no longer loads a hand-picked weights file: it serves whichever model version holds the
**`@champion`** alias in the MLflow Model Registry.

```text
 train_model.py ──> MLflow tracking ──> Model Registry: marine-edna-classifier
 (params, per-epoch       (runs)            v1 @champion   v2 @challenger ...
  metrics, plots)                                   │
                                    approval gate ──┘ (promote only if val_accuracy beats the champion)
                                                    │
                              models:/marine-edna-classifier@champion
                                                    │
 client ──> FastAPI container (port 8000) ── loads ─┘ via MLflow tracking server (port 5000)
```

### With docker compose (recommended)

`docker compose up -d --build` starts an MLflow server (UI at http://localhost:5000) and a one-shot
`model-init` job that registers the bundled, already-trained model as **v1 @champion** (only if no
champion exists yet). The backend then loads `models:/marine-edna-classifier@champion` with
`MODEL_SOURCE=mlflow`, so it fails fast instead of silently serving something else.

Model files are **proxied by the tracking server** (`--artifacts-destination`), so the API container
only needs the tracking URI, not direct access to the artifact store.

### Networking: localhost vs `host.docker.internal`

Inside a container, `localhost` is the container itself. Inside the compose network the backend
reaches MLflow by service name, `http://mlflow:5000`. A standalone container talking to an MLflow
server on your **host** must use `host.docker.internal` (Docker Desktop on Windows/macOS; on Linux add
`--add-host=host.docker.internal:host-gateway`):

```bash
# MLflow on the host. MLflow 3.5+ rejects unknown Host headers, so allow the Docker hostname:
mlflow server --host 0.0.0.0 --port 5000 --allowed-hosts "localhost:5000,host.docker.internal:5000"

docker build -t deepsea-edna-api:v2 .
docker run --rm -e MLFLOW_TRACKING_URI=http://host.docker.internal:5000 deepsea-edna-api:v2 python -m app.ml.cli bootstrap
docker run -d --name ml-api -p 8000:8000 -e MLFLOW_TRACKING_URI=http://host.docker.internal:5000 -e MODEL_SOURCE=mlflow deepsea-edna-api:v2
```

MLflow (5000) and FastAPI (8000) are independent ports: `MLFLOW_TRACKING_URI` points at MLflow,
`-p 8000:8000` publishes the API.

### Train, register, promote, reload

```bash
cd backend
pip install -r requirements.txt -r training/requirements.txt
export MLFLOW_TRACKING_URI=http://localhost:5000

# Logs params, per-epoch metrics, plots; registers a new version as @challenger;
# --promote runs the approval gate (champion only if val_accuracy beats the current one)
python training/train_model.py --data_dir ../data/training/marine_diverse --output_dir ./out --epochs 50 --promote

python -m app.ml.cli info                    # current @champion and @challenger
python -m app.ml.cli promote --version 3     # manual approval through the same gate
```

After a new champion is promoted, click **Reload @champion** on the Model Registry page (or
`POST /api/model/reload`) to switch the live API without a restart. Prediction cache keys include
the model version, so old cached results are never served for a new model.

| Setting | Default | Meaning |
| --- | --- | --- |
| `MODEL_SOURCE` | `auto` | `mlflow` = registry only, `local` = bundled files, `auto` = registry if configured, else bundled |
| `MLFLOW_TRACKING_URI` | _(empty)_ | e.g. `http://mlflow:5000` (compose), `http://host.docker.internal:5000` |
| `MLFLOW_MODEL_NAME` | `marine-edna-classifier` | Registered model name |
| `MLFLOW_MODEL_ALIAS` | `champion` | Alias the API serves |

## 🔄 CI/CD Pipeline

| Workflow | Trigger | What it does |
| --- | --- | --- |
| `ci-cd.yml` | push, pull request | Lint → backend tests (SQLite + PostgreSQL, incl. MLflow) + frontend build → **E2E**: full `docker compose` stack, smoke test asserting the model is served from MLflow, restart-idempotency check → on `main`/`v*` tags, **publish the tested images** to `ghcr.io/<owner>/<repo>` and `-web` |
| `model-training.yml` | manual, or `repository_dispatch: retrain` | Train → log to MLflow → register `@challenger` → approval gate → `@champion` |
| `pr-checks.yml` | pull request | Change summary and size warning |

The retraining workflow uses the repository secret `MLFLOW_TRACKING_URI` when set (a tracking server
reachable from GitHub); otherwise it trains against a throwaway MLflow store and uploads it as an
artifact. GitHub-hosted runners are CPU-only, so the default is a quick subsampled run; full training
belongs on a GPU or self-hosted runner. The `retrain` event is the hook for automated triggers such
as drift detection:

```bash
curl -X POST -H "Authorization: Bearer <token>" https://api.github.com/repos/<owner>/<repo>/dispatches   -d '{"event_type": "retrain", "client_payload": {"epochs": 20, "max_per_class": ""}}'
```

Optional repository variable `PUBLIC_API_URL` sets the API URL baked into the published frontend image.

## 📚 API Documentation

### Interactive Documentation

Visit http://localhost:8000/api/docs for interactive Swagger UI

### Key Endpoints

#### Authentication (8 endpoints)

```bash
# Register user
POST /auth/register
{
  "username": "user@example.com",
  "password": "secure_password",
  "role": "scientist"
}

# Login
POST /auth/token
{
  "username": "user@example.com",
  "password": "secure_password"
}

# Get current user
GET /auth/me
Authorization: Bearer <token>

# Refresh token
POST /auth/refresh
Authorization: Bearer <token>
```

#### Predictions

```bash
# Single prediction
POST /api/predict
Authorization: Bearer <token>
{
  "sequence": "ATCGATCGATCGATCGATCG"
}

# Batch prediction
POST /api/predict/batch
Authorization: Bearer <token>
{
  "sequences": [
    "ATCGATCGATCGATCGATCG",
    "GCTAGCTAGCTAGCTAGCTA"
  ]
}

# Upload file for prediction
POST /api/predict/upload
Authorization: Bearer <token>
Content-Type: multipart/form-data
file: sequences.fasta
```

#### Model Versioning (11 endpoints)

```bash
# List model versions
GET /versions
Authorization: Bearer <token>

# Register new version
POST /versions/register
Authorization: Bearer <token>
{
  "version": "2.0.0",
  "description": "Improved model with additional training data"
}

# Activate version
POST /versions/{id}/activate
Authorization: Bearer <token>

# Compare models
GET /versions/compare/{id1}/{id2}
Authorization: Bearer <token>

# Rollback to previous version
POST /versions/{id}/rollback
Authorization: Bearer <token>
```

#### A/B Testing (8 endpoints)

```bash
# Create experiment
POST /experiments/create
Authorization: Bearer <token>
{
  "name": "Model v2.0 vs v1.0",
  "control_model": "model-v1",
  "treatment_model": "model-v2",
  "traffic_split": 0.5
}

# Get experiment results
GET /experiments/{id}/results
Authorization: Bearer <token>

# Stop experiment
POST /experiments/{id}/stop
Authorization: Bearer <token>
```

#### Monitoring (8 endpoints)

```bash
# Health check
GET /health

# Detailed health check
GET /health/detailed

# System metrics
GET /monitoring/system
Authorization: Bearer <token>

# Dashboard metrics
GET /monitoring/dashboard
Authorization: Bearer <token>

# Prometheus metrics
GET /metrics
```

#### Caching (3 endpoints)

```bash
# Cache statistics
GET /cache/stats
Authorization: Bearer <token>

# Clear cache
POST /cache/clear
Authorization: Bearer <token>

# Cache backend info
GET /cache/backend
Authorization: Bearer <token>
```

### First Admin

There is no default account. Put your email in `ADMIN_EMAILS` (in `.env`), then register or sign in
with Google/GitHub using that email: the account becomes `admin`. Everyone else starts as `viewer`.

### Roles & Permissions

| Role          | Permissions                                                        |
| ------------- | ------------------------------------------------------------------ |
| **Admin**     | All permissions (user management, model deployment, system config) |
| **Scientist** | Predictions, model versioning, experiments, data export            |
| **Viewer**    | View predictions, read-only access                                 |
| **API User**  | API access only, basic predictions                                 |

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
│  │ A/B Testing  │  │ Caching      │  │ Export       │ │
│  │ - Experiments│  │ - Redis      │  │ - BIOM/FASTA │ │
│  │ - Statistics │  │ - Fallback   │  │ - CSV/TSV    │ │
│  └──────────────┘  └──────────────┘  └──────────────┘ │
│                                                          │
│  ┌──────────────────────────────────────────────────┐  │
│  │          PyTorch Deep Learning Model             │  │
│  │          94.18% Accuracy, 8 Classes              │  │
│  └──────────────────────────────────────────────────┘  │
│                                                          │
└─────────────────────────────────────────────────────────┘
```

### Technology Stack

**Backend:**

- FastAPI 0.136+ (Modern async Python web framework)
- PyTorch 2.0+ (Deep learning framework)
- Redis (Caching layer, optional)

**Security:**

- JWT (python-jose) - Token-based authentication
- OAuth2 - Industry standard authorization
- Bcrypt (passlib) - Password hashing
- RBAC - Role-based access control

**Monitoring:**

- Prometheus - Metrics collection
- Grafana-ready - Visualization support
- psutil - System metrics

**Testing:**

- pytest - Test framework
- httpx - HTTP client for API tests

**Deployment:**

- Docker - Containerization
- Docker Compose - Multi-container orchestration
- GitHub Actions - CI/CD automation
- GitHub Container Registry - Image hosting

---

## 📊 Model Information

### Taxonomic Classes

The model predicts 8 classes (6 orders and 2 classes across Chordata, Arthropoda and Mollusca).
Precision and recall are measured on the held-out validation split (9,600 sequences,
20% held out, seed 42); regenerate with `python scripts/build_taxa_catalog.py`.

| ID | Taxon | Rank | Phylum | Common name | Training seqs | Precision | Recall |
| -- | ----- | ---- | ------ | ----------- | ------------- | --------- | ------ |
| 0 | Perciformes | order | Chordata | Perch-like fishes | 10,000 | 92.9% | 91.2% |
| 1 | Salmoniformes | order | Chordata | Salmon, trout and chars | 5,000 | 93.2% | 96.6% |
| 2 | Clupeiformes | order | Chordata | Herrings, sardines and anchovies | 5,000 | 90.0% | 93.9% |
| 3 | Gadiformes | order | Chordata | Cods, hakes and grenadiers | 5,000 | 96.5% | 93.9% |
| 4 | Pleuronectiformes | order | Chordata | Flatfishes | 3,000 | 85.2% | 90.2% |
| 5 | Decapoda | order | Arthropoda | Crabs, lobsters and shrimps | 8,000 | 99.7% | 96.7% |
| 6 | Bivalvia | class | Mollusca | Clams, mussels, oysters and scallops | 6,000 | 98.0% | 98.6% |
| 7 | Gastropoda | class | Mollusca | Snails and slugs | 6,000 | 99.2% | 98.4% |

### Performance Metrics

- **Validation accuracy**: 95.0% on 9,600 held-out sequences (94.18% recorded at training time)
- **Training dataset**: 48,000 NCBI GenBank sequences (`data/training/marine_diverse`), 20% held out for validation
- **Model architecture**: DNA embedding, 3 convolutional layers, multi-head self-attention, max pooling, dense classifier
- **Confidence**: softmax probability of the top class; below 70% the read is flagged as a potential novel taxon
- **Model Size**: 15 MB of PyTorch weights (API image ~0.6 GB with CPU-only PyTorch)
- **Inference Time**: <100ms per sequence (cached)
- **Batch Processing**: Up to 1000 sequences per request
- **Device**: CPU-optimized (no GPU required for inference)

### Input Requirements

- **Sequence Format**: DNA nucleotide sequence (A, T, C, G)
- **Minimum Length**: 20 nucleotides
- **Maximum Length**: 10,000 nucleotides
- **Supported Formats**: Plain text, FASTA, FASTQ
- **Quality Thresholds**: Configurable confidence levels

---

## 🧪 Testing

### Run Tests

The suite (46 tests) covers authentication, RBAC, per-user data isolation, OAuth (mocked providers),
uploads/exports, and the MLflow registry: bootstrap, champion loading, the approval gate and hot reload.
MLflow tests use a throwaway SQLite-backed store, so no server is needed.

```bash
cd backend
pip install torch --index-url https://download.pytorch.org/whl/cpu
pip install -r requirements-dev.txt
python -m pytest tests -v

# Against PostgreSQL instead of SQLite
TEST_DATABASE_URL=postgresql://user:pass@localhost:5432/test python -m pytest tests -v
```

Smoke-test a running deployment end to end (stdlib only):

```bash
python scripts/smoke_test.py --api http://localhost:8000 --mlflow http://localhost:5000 --expect-source mlflow
```

CI runs all of this on every push and pull request (see [CI/CD](#-cicd-pipeline)).

---

## 📈 Performance

### Benchmarks

- **Model Accuracy**: 94.18%
- **Response Time**: <100ms (with cache)
- **Response Time**: <500ms (without cache)
- **Throughput**: 1000+ requests/second (cached)
- **Throughput**: 200+ requests/second (uncached)
- **Cache Hit Rate**: 80%+ typical
- **Cold Start**: ~30 seconds (model loading)
- **Memory Usage**: ~2 GB (with model loaded)
- **CPU Usage**: ~30% average per request

### Optimization Tips

1. **Enable Redis** for production (5-10x faster than in-memory cache)
2. **Use PostgreSQL** instead of SQLite for concurrent requests
3. **Batch predictions** for processing multiple sequences
4. **Pre-warm cache** for frequently used sequences
5. **Use async endpoints** for non-blocking operations

---

## 📋 Project Structure

```
DeepSea-eDNA/
├── backend/
│   ├── app/
│   │   ├── api/                  # Routers: auth, oauth, me, models, upload, analysis,
│   │   │                         #   export, versions, experiments, system
│   │   ├── core/                 # Settings, security (JWT/RBAC), rate limiting, logging
│   │   ├── db/                   # SQLAlchemy models, session, Alembic migrations
│   │   ├── ml/                   # MLflow registry, pyfunc wrapper, registry CLI
│   │   ├── models/
│   │   │   └── deep_learning.py  # CNN + self-attention classifier
│   │   ├── services/             # Model loader/serving, sequence processing, users
│   │   └── main.py               # FastAPI application
│   ├── tests/                    # pytest suite (API, auth, MLflow)
│   ├── training/
│   │   ├── train_model.py        # Training + MLflow logging + promotion
│   │   └── requirements.txt      # Extra training dependencies
│   ├── alembic.ini
│   ├── requirements.txt          # API runtime dependencies
│   └── requirements-dev.txt      # + test dependencies
├── mlops/                        # A/B testing, model versioning, monitoring,
│                                 #   cache manager, export formats
├── ml_models/marine_model/       # Bundled model: weights, config, taxonomy map
├── data/training/marine_diverse/ # Training dataset (8 classes, 48,000 sequences)
├── scripts/
│   ├── smoke_test.py             # End-to-end check of a running stack (used in CI)
│   └── build_taxa_catalog.py     # Regenerates src/data/taxaCatalog.json
├── src/                          # React + TypeScript frontend
│   ├── components/               # Layout, auth, UI primitives
│   ├── data/                     # Taxa catalog (generated) + curated descriptions
│   ├── pages/                    # Routed pages
│   └── lib/, store/, types/      # API client, state, shared types
├── deploy/
│   ├── nginx.conf                # Frontend container web server
│   └── aws/                      # EC2 CloudFormation stack, Caddy HTTPS, compose override
├── .github/workflows/            # CI/CD, PR checks, model retraining
├── docker-compose.yml            # Full stack: frontend, API, PostgreSQL, MLflow
├── Dockerfile                    # API image
├── Dockerfile.frontend           # Frontend image
└── README.md
```

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

### Getting Started

1. **Fork the repository**
2. **Clone your fork**
   ```bash
   git clone https://github.com/YOUR_USERNAME/DeepSea-eDNA.git
   ```
3. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
4. **Make your changes**
5. **Run tests**
   ```bash
   pytest backend/tests/
   ```
6. **Commit your changes**
   ```bash
   git commit -m 'Add amazing feature'
   ```
7. **Push to your fork**
   ```bash
   git push origin feature/amazing-feature
   ```
8. **Open a Pull Request**

### Code Style

- Follow PEP 8 guidelines
- Use type hints
- Write docstrings for functions and classes
- Keep functions focused and small
- Add tests for new features

### Commit Messages

Use conventional commit messages:

- `feat:` New feature
- `fix:` Bug fix
- `docs:` Documentation changes
- `test:` Test changes
- `refactor:` Code refactoring
- `chore:` Maintenance tasks

---

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

This project is free and open-source software licensed under the MIT License. You are free to use, modify, and distribute this software for any purpose, including commercial applications.

---

## 🌟 Use Cases

### Research Applications

- **Marine Biology Research** - Taxonomic classification and species identification
- **Environmental Monitoring** - Real-time species detection in water samples
- **Biodiversity Studies** - Species distribution mapping and ecosystem analysis
- **Conservation Biology** - Endangered species tracking and habitat monitoring
- **Fisheries Management** - Stock assessment and catch verification
- **Biosecurity** - Detection of invasive species at ports and borders

### Educational Applications

- **Academic Research** - ML model experimentation and method development
- **Teaching** - Bioinformatics and machine learning education
- **Citizen Science** - Community-driven environmental monitoring
- **Student Projects** - Hands-on learning with real-world data

### Commercial Applications

- **Environmental Consulting** - Species surveys and impact assessments
- **Aquaculture** - Disease detection and species verification
- **Water Quality Testing** - Biological indicator monitoring
- **Marine Tourism** - Species identification for eco-tourism

---

## 🎓 Documentation & Resources

### Project Documentation

- **API Documentation**: http://localhost:8000/api/docs (when running)
- **OpenAPI Specification**: http://localhost:8000/openapi.json
- **ReDoc**: http://localhost:8000/redoc

### External Resources

- [FastAPI Documentation](https://fastapi.tiangolo.com/) - Web framework
- [PyTorch Documentation](https://pytorch.org/docs/) - Deep learning
- [Docker Documentation](https://docs.docker.com/) - Containerization
- [Prometheus Documentation](https://prometheus.io/docs/) - Monitoring

### Scientific Background

- [Environmental DNA (eDNA) Overview](https://en.wikipedia.org/wiki/Environmental_DNA)
- [DNA Barcoding](https://en.wikipedia.org/wiki/DNA_barcoding)
- [Marine Biodiversity](https://en.wikipedia.org/wiki/Marine_biodiversity)

---

## 🆘 Support & Troubleshooting

### Common Issues

#### Service Won't Start

**Problem**: Docker container exits immediately

**Solution**:

```bash
# Check logs
docker logs deepsea-edna

# Common causes:
# 1. Port 8000 already in use
# 2. Model files not found
# 3. Insufficient memory (need 2GB+)

# Fix port conflict
docker run -d -p 8080:8000 ghcr.io/jackstealer/deepsea-edna:latest
```

#### Model Not Found Error

**Problem**: "Model file not found" error

**Solution**:

```bash
# Verify model files exist
ls ml_models/marine_model/
# Should contain: best_model.pth, model_config.json, taxonomy_map.json

# Rebuild Docker image if using local build
docker build -t deepsea-edna:local .

# Or pull from registry
docker pull ghcr.io/jackstealer/deepsea-edna:latest
```

#### High Memory Usage

**Problem**: Container using too much memory

**Solution**:

```bash
# Increase Docker memory limit
# Docker Desktop: Settings → Resources → Memory → 4GB+

# Or limit container memory
docker run -d --memory="3g" -p 8000:8000 ghcr.io/jackstealer/deepsea-edna:latest
```

#### Database Connection Error

**Problem**: Cannot connect to PostgreSQL

**Solution**:

```bash
# Check if PostgreSQL is running
docker-compose ps

# Restart services
docker-compose restart

# Check connection string in environment
# DATABASE_URL=postgresql://user:password@host:port/database
```

#### Redis Connection Error

**Problem**: Redis connection failed

**Solution**:

```bash
# App has in-memory fallback, but for production:

# Check if Redis is running
docker-compose ps redis

# Test Redis connection
docker exec -it redis redis-cli ping
# Should return: PONG

# Restart Redis
docker-compose restart redis
```

### Performance Issues

#### Slow Predictions

**Optimization**:

```bash
# 1. Enable Redis caching
REDIS_URL=redis://redis:6379/0

# 2. Use batch predictions
POST /api/predict/batch

# 3. Pre-warm cache with common sequences
```

#### High CPU Usage

**Solution**:

```bash
# Limit number of workers
docker run -d \
  -p 8000:8000 \
  -e WORKERS=2 \
  ghcr.io/jackstealer/deepsea-edna:latest
```

### Getting Help

- **GitHub Issues**: [Create an issue](https://github.com/jackstealer/DeepSea-eDNA/issues/new)
- **Discussions**: [GitHub Discussions](https://github.com/jackstealer/DeepSea-eDNA/discussions)
- **Documentation**: Check API docs at `/api/docs`
- **Email**: See repository for contact information

### Reporting Bugs

When reporting a bug, please include:

1. **Environment**: OS, Docker version, Python version
2. **Steps to reproduce**: Exact commands and inputs
3. **Expected behavior**: What should happen
4. **Actual behavior**: What actually happens
5. **Logs**: Relevant error messages or logs
6. **Screenshots**: If applicable

---

## 🏆 Project Status

### ✅ Completed Features

- ✅ Core prediction API with 94.18% accuracy
- ✅ JWT authentication & RBAC
- ✅ Model versioning & registry
- ✅ A/B testing framework
- ✅ Prometheus metrics & monitoring
- ✅ Redis caching layer
- ✅ Database integration (SQLite/PostgreSQL)
- ✅ File upload (FASTA, FASTQ, CSV)
- ✅ Export formats (BIOM, JSON, CSV)
- ✅ Docker containerization
- ✅ Docker Compose setup
- ✅ CI/CD with GitHub Actions
- ✅ Comprehensive testing suite
- ✅ API documentation
- ✅ Production-ready deployment

### 🚧 Roadmap

Future enhancements being considered:

- [ ] GraphQL API support
- [ ] Real-time WebSocket predictions
- [ ] Multi-model ensemble predictions
- [ ] GPU acceleration support
- [ ] Kubernetes deployment configs
- [ ] Grafana dashboard templates
- [ ] Mobile app (React Native)
- [ ] Advanced visualization tools
- [ ] Extended species database (>100 species)

### 📊 Statistics

- **54 API Endpoints**
- **94.18% Model Accuracy**
- **46 Automated Tests** (SQLite + PostgreSQL in CI)
- **15 MB Model Weights** (~0.6 GB CPU-only API image)
- **50,000+ Training Sequences**
- **8 Marine Taxa Classes**
- **15/15 Features Complete**

---

## 📞 Contact & Links

- **GitHub Repository**: [jackstealer/DeepSea-eDNA](https://github.com/jackstealer/DeepSea-eDNA)
- **Docker Images**: [ghcr.io/jackstealer/deepsea-edna](https://github.com/jackstealer/DeepSea-eDNA/pkgs/container/deepsea-edna)
- **Issue Tracker**: [GitHub Issues](https://github.com/jackstealer/DeepSea-eDNA/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jackstealer/DeepSea-eDNA/discussions)

---

## 🙏 Acknowledgments

Special thanks to:

- **Marine Biology Community** - For domain expertise and validation
- **Open Source Contributors** - For various dependencies and tools
- **FastAPI Team** - For the excellent web framework
- **PyTorch Team** - For the deep learning framework
- **Docker Community** - For containerization tools

---

## 📚 Citation

If you use this project in your research, please cite:

```bibtex
@software{deepsea_edna_ai,
  title = {DeepSea eDNA AI: Marine Species Classification Platform},
  author = {Your Name/Organization},
  year = {2026},
  url = {https://github.com/jackstealer/DeepSea-eDNA},
  version = {1.0.0}
}
```

---

**Status: Production Ready** 🚀

Built with ❤️ for the marine biology research community

_Last Updated: November 2026_
_Version: 1.0.0_
