# Build Docker Image

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Building Docker Image" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$imageName = "deepsea-edna-api"
$imageTag = "v1.0"

Write-Host "Image: $imageName:$imageTag" -ForegroundColor Yellow
Write-Host ""

# Check if model exists
$modelPath = "models\best_model.pth"
if (!(Test-Path $modelPath)) {
    Write-Host "❌ Model not found at $modelPath" -ForegroundColor Red
    Write-Host "Please train the model first!" -ForegroundColor Yellow
    exit 1
}

# Build image
docker build -t "${imageName}:${imageTag}" -t "${imageName}:latest" .

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Docker image built successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Run the container with:" -ForegroundColor Yellow
    Write-Host "  .\run_docker.ps1" -ForegroundColor Cyan
} else {
    Write-Host ""
    Write-Host "❌ Docker build failed!" -ForegroundColor Red
}
