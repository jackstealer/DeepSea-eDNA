# DeepSea eDNA Classification - MLOps Pipeline

A production-ready Machine Learning Operations (MLOps) pipeline for taxonomic classification of marine organisms from environmental DNA sequences.

## 🚀 Quick Start

### Prerequisites
- Python 3.11+
- Docker (optional, for containerized deployment)
- MLflow
- NVIDIA GPU (optional, for training)

### 1. Start MLflow Server
```powershell
cd mlops
.\start_mlflow.ps1
```
MLflow UI available at: http://localhost:5000

### 2. Train Model with MLflow Tracking
```powershell
.\train_model.ps1
```

### 3. Run API Server
```powershell
.\run_api.ps1
```
API available at: http://localhost:8000

### 4. Run Tests
```powershell
pytest test_api.py -v
```

## 📁 Project Structure

```
mlops/
├── main.py                    # FastAPI application
├── train_with_mlflow.py       # MLflow training script
├── test_api.py                # API test suite
├── requirements.txt           # Python dependencies
├── Dockerfile                 # Docker configuration
├── models/                    # Trained models
│   ├── best_model.pth
│   ├── model_config.json
│   └── taxonomy_map.json
├── mlflow_data/              # MLflow tracking data
│   ├── mlflow.db             # Experiment database
│   └── artifacts/            # Model artifacts
└── PowerShell scripts:
    ├── start_mlflow.ps1      # Start MLflow server
    ├── train_model.ps1       # Train with tracking
    ├── run_api.ps1           # Run API locally
    ├── build_docker.ps1      # Build Docker image
    └── run_docker.ps1        # Run Docker container
```

## 🌐 API Endpoints

Once running, access the API at http://localhost:8000

- **GET /** - Welcome message
- **GET /health** - Health check with model status
- **POST /predict** - Classify single DNA sequence
- **POST /predict/batch** - Batch classification (up to 100 sequences)
- **GET /model/info** - Model metadata and taxonomy
- **GET /docs** - Interactive API documentation (Swagger UI)
- **GET /redoc** - Alternative API documentation

## 📊 Example Usage

### cURL
```bash
curl -X POST http://localhost:8000/predict \
  -H "Content-Type: application/json" \
  -d '{"sequence": "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"}'
```

### Python
```python
import requests

url = "http://localhost:8000/predict"
data = {"sequence": "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"}

response = requests.post(url, json=data)
print(response.json())

# Output:
# {
#   "class_id": 0,
#   "class_name": "Perciformes",
#   "common_name": "Perch-like fishes",
#   "confidence": 0.95,
#   "model_version": "1"
# }
```

### PowerShell
```powershell
$body = @{
    sequence = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/predict" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

### Batch Prediction
```python
import requests

url = "http://localhost:8000/predict/batch"
data = {
    "sequences": [
        "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG",
        "GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA",
        "TTAGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTG"
    ]
}

response = requests.post(url, json=data)
print(response.json())
```

## 🐳 Docker Deployment

### Build Image
```powershell
.\build_docker.ps1
```

### Run Container
```powershell
.\run_docker.ps1
```

### Docker Commands
```powershell
# View running containers
docker ps

# View logs
docker logs -f deepsea-edna-api

# Stop container
docker stop deepsea-edna-api

# Remove container
docker rm deepsea-edna-api

# Remove image
docker rmi deepsea-edna-api:v1.0
```

## 📦 MLflow Model Registry

### View Experiments
1. Open http://localhost:5000
2. Navigate to "Experiments"
3. Select "DeepSea_eDNA_Classification"

### Model Versioning
- Models are automatically registered in MLflow
- Champion model gets the "champion" alias
- Load champion model: `models:/DeepSeaeDNAClassifier@champion`

### Track Training Metrics
- Training/Validation Loss
- Training/Validation Accuracy
- F1 Score
- Learning Rate Schedule
- Confusion Matrix
- Training Curves

## 🧪 Quality Gates

The training pipeline includes automatic quality gates:

- **Minimum Validation Accuracy**: 90%
- **Minimum F1 Score**: 0.90

If these thresholds aren't met, training fails and the model is not registered.

## 📊 Supported Taxonomic Classes

| Class ID | Scientific Name | Common Name |
|----------|----------------|-------------|
| 0 | Perciformes | Perch-like fishes |
| 1 | Salmoniformes | Salmon |
| 2 | Clupeiformes | Herring |
| 3 | Gadiformes | Cod |
| 4 | Pleuronectiformes | Flatfish |
| 5 | Decapoda | Crabs/Lobsters |
| 6 | Bivalvia | Clams/Mussels |
| 7 | Gastropoda | Snails/Slugs |

## 🔧 Training Configuration

Edit `train_with_mlflow.py` to adjust:

```python
TRAINING_CONFIG = {
    "epochs": 150,              # Number of training epochs
    "batch_size": 64,           # Batch size
    "learning_rate": 0.001,     # Initial learning rate
    "dropout": 0.4,             # Dropout rate (anti-overfitting)
    "weight_decay": 5e-4,       # L2 regularization
    "early_stopping_patience": 20,  # Early stopping patience
}
```

## 🚀 CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/mlops-ci-cd.yml`):

1. **Test**: Lint, format check, unit tests
2. **Build**: Docker image build and push
3. **Security**: Vulnerability scanning with Trivy
4. **Deploy Staging**: Auto-deploy to staging on `develop` branch
5. **Deploy Production**: Auto-deploy to production on `main` branch

### Required Secrets
Set these in GitHub repository settings:

- `DOCKER_USERNAME` - Docker Hub username
- `DOCKER_PASSWORD` - Docker Hub password/token

## 📈 Model Performance

Current champion model:
- **Validation Accuracy**: 94.18%
- **F1 Score**: 0.9432
- **Training Data**: 48,000 sequences across 8 classes

## 🔍 Monitoring

### Health Check
```bash
curl http://localhost:8000/health
```

Response:
```json
{
  "status": "healthy",
  "model_loaded": true,
  "model_version": "1",
  "device": "cuda"
}
```

### Docker Health Check
The Docker container includes automatic health checks every 30 seconds.

## 🛠️ Development

### Local Development
```powershell
# Install dependencies
pip install -r requirements.txt

# Run API with auto-reload
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### Run Tests
```powershell
pytest test_api.py -v --cov=main
```

## 🌍 Cloud Deployment

### AWS ECS
```bash
# Tag image
docker tag deepsea-edna-api:v1.0 your-ecr-repo/deepsea-edna-api:v1.0

# Push to ECR
docker push your-ecr-repo/deepsea-edna-api:v1.0

# Deploy to ECS (via console or CLI)
```

### Azure Container Instances
```bash
az container create \
  --resource-group myResourceGroup \
  --name deepsea-edna-api \
  --image your-acr/deepsea-edna-api:v1.0 \
  --dns-name-label deepsea-edna \
  --ports 8000
```

### Google Cloud Run
```bash
# Push to GCR
docker tag deepsea-edna-api:v1.0 gcr.io/your-project/deepsea-edna-api:v1.0
docker push gcr.io/your-project/deepsea-edna-api:v1.0

# Deploy
gcloud run deploy deepsea-edna-api \
  --image gcr.io/your-project/deepsea-edna-api:v1.0 \
  --platform managed \
  --region us-central1 \
  --allow-unauthenticated
```

## 📝 License

This project is for educational and research purposes.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📚 References

- [MLflow Documentation](https://mlflow.org/docs/latest/index.html)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [PyTorch Documentation](https://pytorch.org/docs/)
- [Docker Documentation](https://docs.docker.com/)

---

Built with ❤️ for marine biodiversity research
