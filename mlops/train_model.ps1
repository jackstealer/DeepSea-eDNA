# Train Model with MLflow Tracking
# Make sure MLflow server is running first (start_mlflow.ps1)

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "MLOps Training Pipeline" -ForegroundColor Cyan
Write-Host "DeepSea eDNA Classification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if MLflow is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:5000/health" -TimeoutSec 2 -ErrorAction Stop
    Write-Host "✅ MLflow server is running" -ForegroundColor Green
} catch {
    Write-Host "❌ MLflow server is not running!" -ForegroundColor Red
    Write-Host "Please start MLflow first using: .\start_mlflow.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host ""
Write-Host "Starting training with MLflow tracking..." -ForegroundColor Yellow
Write-Host ""

# Set environment variables
$env:KMP_DUPLICATE_LIB_OK = "TRUE"
$env:MLFLOW_TRACKING_URI = "http://127.0.0.1:5000"

# Run training
python train_with_mlflow.py

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Training Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "View results at: http://localhost:5000" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Red
    Write-Host "❌ Training Failed!" -ForegroundColor Red
    Write-Host "========================================" -ForegroundColor Red
}
