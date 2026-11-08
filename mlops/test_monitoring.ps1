# Test Script for Feature #6: Monitoring & Observability
# Tests system metrics, health checks, and monitoring dashboard

$BASE_URL = "http://localhost:8000"

Write-Host "`n=== Feature #6: Monitoring & Observability Tests ===" -ForegroundColor Cyan
Write-Host "Testing monitoring endpoints...`n" -ForegroundColor Yellow

# Test 1: Basic health check
Write-Host "1. Testing basic health check..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "Status: $($response.status)" -ForegroundColor White
    Write-Host "Model Loaded: $($response.model_loaded)" -ForegroundColor White
    Write-Host "Cache Backend: $($response.cache_backend)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 2: Detailed health check
Write-Host "2. Testing detailed health check..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/health/detailed" -Method Get
    Write-Host "Overall Status: $($response.status)" -ForegroundColor White
    Write-Host "Timestamp: $($response.timestamp)" -ForegroundColor White
    Write-Host "`nComponents:" -ForegroundColor Yellow
    Write-Host "  API: $($response.components.api.status) (Uptime: $($response.components.api.uptime))" -ForegroundColor White
    Write-Host "  Model: $($response.components.model.status)" -ForegroundColor White
    Write-Host "  Cache: $($response.components.cache.status) ($($response.components.cache.backend))" -ForegroundColor White
    
    if ($response.components.system.cpu) {
        Write-Host "`nSystem Resources:" -ForegroundColor Yellow
        Write-Host "  CPU: $($response.components.system.cpu.usage_percent)% ($($response.components.system.cpu.status))" -ForegroundColor White
        Write-Host "  Memory: $($response.components.system.memory.usage_percent)% ($($response.components.system.memory.status))" -ForegroundColor White
        Write-Host "  Disk: $($response.components.system.disk.usage_percent)% ($($response.components.system.disk.status))`n" -ForegroundColor White
    }
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 3: System metrics
Write-Host "3. Testing system metrics endpoint..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/monitoring/system" -Method Get
    
    Write-Host "CPU:" -ForegroundColor Yellow
    Write-Host "  Usage: $($response.cpu.usage_percent)%" -ForegroundColor White
    Write-Host "  Cores: $($response.cpu.count)" -ForegroundColor White
    Write-Host "  Status: $($response.cpu.status)" -ForegroundColor White
    
    Write-Host "`nMemory:" -ForegroundColor Yellow
    $memGB = [math]::Round($response.memory.used_bytes / 1GB, 2)
    $memTotalGB = [math]::Round($response.memory.total_bytes / 1GB, 2)
    Write-Host "  Used: $memGB GB / $memTotalGB GB" -ForegroundColor White
    Write-Host "  Usage: $($response.memory.usage_percent)%" -ForegroundColor White
    Write-Host "  Status: $($response.memory.status)" -ForegroundColor White
    
    Write-Host "`nDisk:" -ForegroundColor Yellow
    $diskGB = [math]::Round($response.disk.used_bytes / 1GB, 2)
    $diskTotalGB = [math]::Round($response.disk.total_bytes / 1GB, 2)
    Write-Host "  Used: $diskGB GB / $diskTotalGB GB" -ForegroundColor White
    Write-Host "  Usage: $($response.disk.usage_percent)%" -ForegroundColor White
    Write-Host "  Status: $($response.disk.status)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 4: Application metrics
Write-Host "4. Testing application metrics..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/monitoring/application" -Method Get
    Write-Host "Status: $($response.status)" -ForegroundColor White
    Write-Host "Uptime: $($response.uptime_human)" -ForegroundColor White
    Write-Host "Timestamp: $($response.timestamp)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 5: Make some predictions to generate metrics
Write-Host "5. Generating prediction metrics..." -ForegroundColor Green
$sequences = @(
    "ATCGATCGATCG",
    "GCTAGCTAGCTA",
    "TTAACCGGTTAA",
    "ATCGATCGATCG"  # Repeat for cache hit
)

foreach ($seq in $sequences) {
    try {
        $body = @{
            sequence = $seq
            use_cache = $true
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/predict" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body
        
        $cacheStatus = if ($response.cached) { "(cached)" } else { "(fresh)" }
        Write-Host "  Predicted: $($response.predicted_class) - Confidence: $($response.confidence) $cacheStatus" -ForegroundColor White
    } catch {
        Write-Host "  Failed for $seq" -ForegroundColor Red
    }
}
Write-Host ""

# Test 6: Dashboard metrics
Write-Host "6. Testing monitoring dashboard..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/monitoring/dashboard" -Method Get
    
    Write-Host "Overview:" -ForegroundColor Yellow
    Write-Host "  Status: $($response.overview.status)" -ForegroundColor White
    Write-Host "  Uptime: $($response.overview.uptime)" -ForegroundColor White
    
    Write-Host "`nPredictions:" -ForegroundColor Yellow
    Write-Host "  Total: $($response.predictions.total)" -ForegroundColor White
    Write-Host "  Rate: $($response.predictions.rate_per_minute) per minute" -ForegroundColor White
    
    Write-Host "`nRequests:" -ForegroundColor Yellow
    Write-Host "  Total: $($response.requests.total)" -ForegroundColor White
    Write-Host "  Rate: $($response.requests.rate_per_minute) per minute" -ForegroundColor White
    
    Write-Host "`nErrors:" -ForegroundColor Yellow
    Write-Host "  Total: $($response.errors.total)" -ForegroundColor White
    Write-Host "  Rate: $($response.errors.rate_per_minute) per minute" -ForegroundColor White
    
    Write-Host "`nModel:" -ForegroundColor Yellow
    Write-Host "  Status: $($response.model.status)" -ForegroundColor White
    Write-Host "  Loaded: $($response.model.loaded)" -ForegroundColor White
    
    Write-Host "`nCache:" -ForegroundColor Yellow
    Write-Host "  Total Keys: $($response.cache.total_keys)" -ForegroundColor White
    Write-Host "  Hits: $($response.cache.hits)" -ForegroundColor White
    Write-Host "  Misses: $($response.cache.misses)" -ForegroundColor White
    Write-Host "  Hit Rate: $($response.cache.hit_rate)%`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 7: Prometheus metrics
Write-Host "7. Testing Prometheus metrics endpoint..." -ForegroundColor Green
try {
    $response = Invoke-WebRequest -Uri "$BASE_URL/metrics" -Method Get
    $lines = $response.Content -split "`n" | Where-Object { $_ -notmatch "^#" -and $_ -ne "" }
    Write-Host "Available Prometheus metrics: $($lines.Count)" -ForegroundColor White
    Write-Host "Sample metrics:" -ForegroundColor Yellow
    $lines | Select-Object -First 5 | ForEach-Object {
        Write-Host "  $_" -ForegroundColor White
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

Write-Host "=== Monitoring Testing Complete ===" -ForegroundColor Cyan
Write-Host "`nMonitoring Features:" -ForegroundColor Yellow
Write-Host "  ✓ Basic and detailed health checks" -ForegroundColor Green
Write-Host "  ✓ System resource monitoring (CPU, memory, disk)" -ForegroundColor Green
Write-Host "  ✓ Application uptime tracking" -ForegroundColor Green
Write-Host "  ✓ Prediction and request counters" -ForegroundColor Green
Write-Host "  ✓ Error tracking" -ForegroundColor Green
Write-Host "  ✓ Cache hit/miss tracking" -ForegroundColor Green
Write-Host "  ✓ Model status monitoring" -ForegroundColor Green
Write-Host "  ✓ Prometheus metrics export" -ForegroundColor Green
Write-Host "  ✓ Unified dashboard metrics" -ForegroundColor Green
Write-Host "`nPrometheus metrics available at: $BASE_URL/metrics" -ForegroundColor Cyan
Write-Host "Dashboard data available at: $BASE_URL/monitoring/dashboard" -ForegroundColor Cyan
