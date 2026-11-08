# Run FastAPI Application
# Serves the trained model as REST API

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting DeepSea eDNA API Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

# Check if model exists
$modelPath = "models\best_model.pth"
if (!(Test-Path $modelPath)) {
    Write-Host "❌ Model not found at $modelPath" -ForegroundColor Red
    Write-Host "Please train the model first using: .\train_model.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "✅ Model found" -ForegroundColor Green
Write-Host ""
Write-Host "API will be available at:" -ForegroundColor Yellow
Write-Host "  - Main: http://localhost:8000" -ForegroundColor Yellow
Write-Host "  - Docs: http://localhost:8000/docs" -ForegroundColor Yellow
Write-Host "  - Health: http://localhost:8000/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

# Set environment variables
$env:MLFLOW_TRACKING_URI = "http://127.0.0.1:5000"

# Run API
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
