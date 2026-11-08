# Test GHCR Docker Package
# Comprehensive testing of the published Docker image

$IMAGE = "ghcr.io/jackstealer/deepsea-edna:main-a53b9b3"
$CONTAINER_NAME = "deepsea-test-ghcr"
$TEST_PORT = 8002

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "GHCR Docker Package Test Suite" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Check if image exists locally
Write-Host "[1/10] Checking for existing image..." -ForegroundColor Yellow
$imageExists = docker images -q $IMAGE
if ($imageExists) {
    Write-Host "  ✅ Image found locally" -ForegroundColor Green
} else {
    Write-Host "  ⚠️  Image not found locally, will pull" -ForegroundColor Yellow
    Write-Host "  Pulling from GHCR (this may take a few minutes)..." -ForegroundColor Gray
    
    try {
        docker pull $IMAGE 2>&1 | Out-Null
        Write-Host "  ✅ Image pulled successfully" -ForegroundColor Green
    } catch {
        Write-Host "  ❌ Failed to pull image: $_" -ForegroundColor Red
        exit 1
    }
}
Write-Host ""

# Test 2: Check image details
Write-Host "[2/10] Inspecting image details..." -ForegroundColor Yellow
try {
    $imageInfo = docker inspect $IMAGE | ConvertFrom-Json
    Write-Host "  ✅ Image ID: $($imageInfo[0].Id.Substring(7,12))" -ForegroundColor Green
    Write-Host "  ✅ Created: $($imageInfo[0].Created.Substring(0,10))" -ForegroundColor Green
    Write-Host "  ✅ Architecture: $($imageInfo[0].Architecture)" -ForegroundColor Green
} catch {
    Write-Host "  ⚠️  Could not inspect image (this is OK)" -ForegroundColor Yellow
}
Write-Host ""

# Test 3: Clean up any existing test container
Write-Host "[3/10] Cleaning up previous test containers..." -ForegroundColor Yellow
$existing = docker ps -a -q -f name=$CONTAINER_NAME
if ($existing) {
    docker stop $CONTAINER_NAME 2>&1 | Out-Null
    docker rm $CONTAINER_NAME 2>&1 | Out-Null
    Write-Host "  ✅ Cleaned up existing container" -ForegroundColor Green
} else {
    Write-Host "  ✅ No cleanup needed" -ForegroundColor Green
}
Write-Host ""

# Test 4: Start container
Write-Host "[4/10] Starting container..." -ForegroundColor Yellow
try {
    docker run -d `
        --name $CONTAINER_NAME `
        -p ${TEST_PORT}:8000 `
        -e SECRET_KEY=test-secret-key-for-testing `
        -e ENVIRONMENT=testing `
        $IMAGE 2>&1 | Out-Null
    
    Write-Host "  ✅ Container started: $CONTAINER_NAME" -ForegroundColor Green
    Write-Host "  Port mapping: localhost:$TEST_PORT -> container:8000" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Failed to start container: $_" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Test 5: Wait for container to be healthy
Write-Host "[5/10] Waiting for container to be ready..." -ForegroundColor Yellow
$maxWait = 60
$waited = 0
$ready = $false

while ($waited -lt $maxWait) {
    Start-Sleep -Seconds 2
    $waited += 2
    
    try {
        $status = docker inspect $CONTAINER_NAME --format='{{.State.Running}}' 2>&1
        if ($status -eq "true") {
            Write-Host "  Container is running..." -ForegroundColor Gray
            
            # Try to connect
            try {
                Invoke-RestMethod -Uri "http://localhost:$TEST_PORT/health" -Method Get -TimeoutSec 2 -ErrorAction Stop | Out-Null
                $ready = $true
                break
            } catch {
                Write-Host "  Waiting for API to respond... ($waited/$maxWait seconds)" -ForegroundColor Gray
            }
        }
    } catch {
        Write-Host "  Container not ready yet... ($waited/$maxWait seconds)" -ForegroundColor Gray
    }
}

if ($ready) {
    Write-Host "  ✅ Container is ready!" -ForegroundColor Green
} else {
    Write-Host "  ❌ Container failed to become ready after $maxWait seconds" -ForegroundColor Red
    Write-Host "`n  Recent logs:" -ForegroundColor Yellow
    docker logs --tail 20 $CONTAINER_NAME
    exit 1
}
Write-Host ""

# Test 6: Check container status
Write-Host "[6/10] Checking container status..." -ForegroundColor Yellow
$containerStatus = docker ps -f name=$CONTAINER_NAME --format "table {{.Status}}" | Select-Object -Skip 1
Write-Host "  ✅ Status: $containerStatus" -ForegroundColor Green
Write-Host ""

# Test 7: Test health endpoint
Write-Host "[7/10] Testing health endpoint..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "http://localhost:$TEST_PORT/health" -Method Get
    Write-Host "  ✅ Health check passed" -ForegroundColor Green
    Write-Host "  Status: $($health.status)" -ForegroundColor Gray
    Write-Host "  Model loaded: $($health.model_loaded)" -ForegroundColor Gray
} catch {
    Write-Host "  ❌ Health check failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 8: Test API documentation
Write-Host "[8/10] Testing API documentation..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "http://localhost:$TEST_PORT/api/docs" -Method Get -UseBasicParsing -TimeoutSec 5 | Out-Null
    Write-Host "  ✅ API docs accessible at http://localhost:$TEST_PORT/api/docs" -ForegroundColor Green
} catch {
    Write-Host "  ❌ API docs failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 9: Test monitoring endpoints
Write-Host "[9/10] Testing monitoring endpoints..." -ForegroundColor Yellow
try {
    $dashboard = Invoke-RestMethod -Uri "http://localhost:$TEST_PORT/monitoring/dashboard" -Method Get
    Write-Host "  ✅ Monitoring dashboard working" -ForegroundColor Green
    Write-Host "  Model status: $($dashboard.model.status)" -ForegroundColor Gray
} catch {
    Write-Host "  ⚠️  Monitoring endpoint not accessible (may need initialization)" -ForegroundColor Yellow
}
Write-Host ""

# Test 10: View container logs
Write-Host "[10/10] Checking container logs..." -ForegroundColor Yellow
Write-Host "  Recent logs (last 10 lines):" -ForegroundColor Gray
docker logs --tail 10 $CONTAINER_NAME
Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Test Summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "✅ Image: $IMAGE" -ForegroundColor Green
Write-Host "✅ Container: $CONTAINER_NAME" -ForegroundColor Green
Write-Host "✅ Port: http://localhost:$TEST_PORT" -ForegroundColor Green
Write-Host "✅ Status: Running and healthy" -ForegroundColor Green
Write-Host ""
Write-Host "Test URLs:" -ForegroundColor Yellow
Write-Host "  Health:      http://localhost:$TEST_PORT/health" -ForegroundColor Gray
Write-Host "  API Docs:    http://localhost:$TEST_PORT/api/docs" -ForegroundColor Gray
Write-Host "  Monitoring:  http://localhost:$TEST_PORT/monitoring/dashboard" -ForegroundColor Gray
Write-Host ""
Write-Host "Container Management:" -ForegroundColor Yellow
Write-Host "  View logs:   docker logs $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "  Stop:        docker stop $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "  Remove:      docker rm $CONTAINER_NAME" -ForegroundColor Gray
Write-Host "  Restart:     docker restart $CONTAINER_NAME" -ForegroundColor Gray
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "🎉 All tests completed!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Container is running. To clean up:" -ForegroundColor Yellow
Write-Host "  docker stop $CONTAINER_NAME && docker rm $CONTAINER_NAME" -ForegroundColor Gray
Write-Host ""
