# Start MLflow Tracking Server
# Run this first before training

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Starting MLflow Tracking Server" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$mlflowDir = "mlflow_data"
if (!(Test-Path $mlflowDir)) {
    New-Item -ItemType Directory -Path $mlflowDir | Out-Null
    Write-Host "Created MLflow data directory: $mlflowDir" -ForegroundColor Green
}

Write-Host ""
Write-Host "MLflow UI will be available at: http://localhost:5000" -ForegroundColor Yellow
Write-Host "Press Ctrl+C to stop the server" -ForegroundColor Yellow
Write-Host ""

mlflow server `
    --backend-store-uri sqlite:///mlflow_data/mlflow.db `
    --default-artifact-root ./mlflow_data/artifacts `
    --host 0.0.0.0 `
    --port 5000
