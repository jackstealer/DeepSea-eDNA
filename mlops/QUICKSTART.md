# MLOps Pipeline - Quick Start Guide

## 🎯 Complete Setup in 5 Steps

### Step 1: Install MLflow
```powershell
pip install mlflow
```

### Step 2: Copy Trained Model
```powershell
# Copy the best model from your training directory
Copy-Item "..\ml_models\marine_model\best_model.pth" -Destination "models\"
Copy-Item "..\ml_models\marine_model\model_config.json" -Destination "models\"
Copy-Item "..\ml_models\marine_model\taxonomy_map.json" -Destination "models\"
```

### Step 3: Start MLflow Server
Open **Terminal 1**:
```powershell
cd mlops
.\start_mlflow.ps1
```
Keep this terminal open. MLflow UI: http://localhost:5000

### Step 4: Run API Server
Open **Terminal 2**:
```powershell
cd mlops
.\run_api.ps1
```
API will be available at: http://localhost:8000

### Step 5: Test the API
Open **Terminal 3** or browser:

**Visit:** http://localhost:8000/docs

**Or use PowerShell:**
```powershell
$body = @{
    sequence = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:8000/predict" `
    -Method Post `
    -Body $body `
    -ContentType "application/json"
```

## 🎉 Success!

You should see output like:
```json
{
  "class_id": 0,
  "class_name": "Perciformes",
  "common_name": "Perch-like fishes",
  "confidence": 0.95,
  "model_version": "local"
}
```

## 🔄 Complete MLOps Workflow

### Option A: Train with MLflow (Recommended)
```powershell
# Terminal 1: Start MLflow
.\start_mlflow.ps1

# Terminal 2: Train model
.\train_model.ps1

# After training completes:
# Terminal 2: Run API
.\run_api.ps1
```

### Option B: Docker Deployment
```powershell
# Build Docker image
.\build_docker.ps1

# Run container
.\run_docker.ps1

# API available at http://localhost:8000
```

## 📊 View Training Results

1. Open MLflow UI: http://localhost:5000
2. Click "DeepSea_eDNA_Classification" experiment
3. View metrics, parameters, and artifacts

## 🧪 Run Tests

```powershell
pip install pytest
pytest test_api.py -v
```

## 🐛 Troubleshooting

### Model not found
```powershell
# Make sure models directory exists and has files
ls models\
# Should show: best_model.pth, model_config.json, taxonomy_map.json
```

### MLflow not running
```bash
# Check if MLflow is running
Invoke-WebRequest -Uri "http://localhost:5000/health"
```

### Port already in use
```powershell
# Find process using port 8000
netstat -ano | findstr :8000

# Kill process (replace <PID> with actual process ID)
taskkill /PID <PID> /F
```

## 📚 Next Steps

1. ✅ API is running
2. 📝 Read full [README.md](README.md)
3. 🐳 Try Docker deployment
4. 🚀 Setup CI/CD with GitHub Actions
5. ☁️  Deploy to cloud (AWS/Azure/GCP)

---

Need help? Check the full README or open an issue!
