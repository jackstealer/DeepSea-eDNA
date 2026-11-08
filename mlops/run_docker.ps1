# Run Docker Container

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Running DeepSea eDNA API Container" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

$containerName = "deepsea-edna-api"
$imageName = "deepsea-edna-api:v1.2"
$port = 8000

# Check if image exists
$imageExists = docker images -q $imageName
if (!$imageExists) {
    Write-Host "❌ Docker image not found: $imageName" -ForegroundColor Red
    Write-Host "Build the image first using: .\build_docker.ps1" -ForegroundColor Yellow
    exit 1
}

# Stop and remove existing container
$existing = docker ps -a -q --filter "name=$containerName"
if ($existing) {
    Write-Host "Stopping existing container..." -ForegroundColor Yellow
    docker stop $containerName | Out-Null
    docker rm $containerName | Out-Null
}

# Run container
Write-Host "Starting container..." -ForegroundColor Yellow
docker run -d `
    --name $containerName `
    -p ${port}:8000 `
    --add-host=host.docker.internal:host-gateway `
    $imageName

if ($LASTEXITCODE -eq 0) {
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "✅ Container started successfully!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "API available at:" -ForegroundColor Yellow
    Write-Host "  - Main: http://localhost:$port" -ForegroundColor Cyan
    Write-Host "  - Docs: http://localhost:${port}/docs" -ForegroundColor Cyan
    Write-Host "  - Health: http://localhost:${port}/health" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "View logs: docker logs -f $containerName" -ForegroundColor Yellow
    Write-Host "Stop container: docker stop $containerName" -ForegroundColor Yellow
} else {
    Write-Host ""
    Write-Host "❌ Failed to start container!" -ForegroundColor Red
}
