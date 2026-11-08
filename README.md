# DeepSea eDNA AI - MLOps Pipeline

Production-ready Machine Learning Operations pipeline for marine taxonomic classification from environmental DNA sequences.

## 🚀 Quick Start

See the [MLOps README](mlops/README.md) for complete documentation.

## 📁 Project Structure

```
├── mlops/                   # MLOps pipeline
│   ├── main.py             # FastAPI REST API
│   ├── train_with_mlflow.py # MLflow training
│   └── ...
├── backend/                 # Backend services
├── data/                    # Training data
└── ml_models/              # Trained models
```

## 🎯 Features

- MLflow experiment tracking
- FastAPI REST API
- Docker containerization
- GitHub Actions CI/CD
- Quality gates (90% accuracy threshold)
- Model versioning

For full documentation, visit [mlops/README.md](mlops/README.md)
