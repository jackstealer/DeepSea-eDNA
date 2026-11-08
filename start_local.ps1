# Start DeepSea eDNA API Locally
# This script starts the API server for local testing

Write-Host "`n=== Starting DeepSea eDNA API Locally ===" -ForegroundColor Cyan

# Check Python
Write-Host "`nChecking Python..." -ForegroundColor Yellow
python --version
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Python not found!" -ForegroundColor Red
    exit 1
}

# Set working directory
$projectRoot = $PSScriptRoot
Set-Location "$projectRoot\backend"

# Set environment variables
$env:PYTHONPATH = $projectRoot
$env:MODEL_DIR = "$projectRoot\ml_models\marine_model"

Write-Host "`nPython path: $env:PYTHONPATH" -ForegroundColor Gray
Write-Host "Model directory: $env:MODEL_DIR" -ForegroundColor Gray

# Start the API
Write-Host "`n=== Starting API Server ===" -ForegroundColor Green
Write-Host "API will be available at: http://localhost:8000" -ForegroundColor Cyan
Write-Host "API Docs: http://localhost:8000/api/docs" -ForegroundColor Cyan
Write-Host "Health Check: http://localhost:8000/health" -ForegroundColor Cyan
Write-Host "Press Ctrl+C to stop the server`n" -ForegroundColor Yellow

uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
