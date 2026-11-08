# Phase 1: Simplified Local Testing
# Tests core features that are currently implemented

$BASE_URL = "http://localhost:8000"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Phase 1: Local Testing & Verification" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Basic Health Check
Write-Host "[1] Basic Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "  SUCCESS - Status: $($health.status)" -ForegroundColor Green
    Write-Host "  Model loaded: $($health.model_loaded)" -ForegroundColor Gray
    Write-Host "  Cache backend: $($health.cache_backend)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 2: Detailed Health Check
Write-Host "[2] Detailed Health Check..." -ForegroundColor Yellow
try {
    $detailed = Invoke-RestMethod -Uri "$BASE_URL/health/detailed" -Method Get
    Write-Host "  SUCCESS - Comprehensive health check working" -ForegroundColor Green
    Write-Host "  Status: $($detailed.status)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 3: System Metrics
Write-Host "[3] System Metrics..." -ForegroundColor Yellow
try {
    $system = Invoke-RestMethod -Uri "$BASE_URL/monitoring/system" -Method Get
    Write-Host "  SUCCESS - System metrics retrieved" -ForegroundColor Green
    Write-Host "  CPU: $($system.cpu_percent)%" -ForegroundColor Gray
    Write-Host "  Memory: $($system.memory_percent)%`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 4: Application Metrics
Write-Host "[4] Application Metrics..." -ForegroundColor Yellow
try {
    $app = Invoke-RestMethod -Uri "$BASE_URL/monitoring/application" -Method Get
    Write-Host "  SUCCESS - Application metrics retrieved" -ForegroundColor Green
    Write-Host "  Request count: $($app.request_count)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 5: Monitoring Dashboard
Write-Host "[5] Monitoring Dashboard..." -ForegroundColor Yellow
try {
    $dashboard = Invoke-RestMethod -Uri "$BASE_URL/monitoring/dashboard" -Method Get
    Write-Host "  SUCCESS - Dashboard data retrieved" -ForegroundColor Green
    Write-Host "  Model status: $($dashboard.model.status)" -ForegroundColor Gray
    Write-Host "  Cache backend: $($dashboard.cache.backend)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 6: Cache Stats
Write-Host "[6] Cache Management..." -ForegroundColor Yellow
try {
    $cache = Invoke-RestMethod -Uri "$BASE_URL/cache/stats" -Method Get
    Write-Host "  SUCCESS - Cache stats retrieved" -ForegroundColor Green
    Write-Host "  Backend: $($cache.backend)" -ForegroundColor Gray
    Write-Host "  Hit rate: $($cache.hit_rate)%`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 7: Cache Backend Info
Write-Host "[7] Cache Backend Info..." -ForegroundColor Yellow
try {
    $backend = Invoke-RestMethod -Uri "$BASE_URL/cache/backend" -Method Get
    Write-Host "  SUCCESS - Backend: $($backend.backend)" -ForegroundColor Green
    Write-Host "  Description: $($backend.description)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 8: Model Versions List
Write-Host "[8] Model Versioning..." -ForegroundColor Yellow
try {
    $versions = Invoke-RestMethod -Uri "$BASE_URL/versions" -Method Get
    Write-Host "  SUCCESS - Versions retrieved" -ForegroundColor Green
    Write-Host "  Total versions: $($versions.total)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 9: Current Version
Write-Host "[9] Current Model Version..." -ForegroundColor Yellow
try {
    $current = Invoke-RestMethod -Uri "$BASE_URL/versions/current/info" -Method Get
    Write-Host "  SUCCESS - Current version: $($current.version_name)" -ForegroundColor Green
    Write-Host "  Version ID: $($current.version_id)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 10: Version History
Write-Host "[10] Version History..." -ForegroundColor Yellow
try {
    $history = Invoke-RestMethod -Uri "$BASE_URL/versions/history" -Method Get
    Write-Host "  SUCCESS - History retrieved" -ForegroundColor Green
    Write-Host "  Total entries: $($history.total)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 11: Version Statistics
Write-Host "[11] Version Statistics..." -ForegroundColor Yellow
try {
    $stats = Invoke-RestMethod -Uri "$BASE_URL/versions/statistics" -Method Get
    Write-Host "  SUCCESS - Statistics retrieved" -ForegroundColor Green
    Write-Host "  Total versions: $($stats.total_versions)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 12: A/B Testing - List Experiments
Write-Host "[12] A/B Testing - List Experiments..." -ForegroundColor Yellow
try {
    $experiments = Invoke-RestMethod -Uri "$BASE_URL/experiments" -Method Get
    Write-Host "  SUCCESS - Experiments retrieved" -ForegroundColor Green
    Write-Host "  Total experiments: $($experiments.total)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 13: A/B Testing - Active Experiment
Write-Host "[13] A/B Testing - Active Experiment..." -ForegroundColor Yellow
try {
    $active = Invoke-RestMethod -Uri "$BASE_URL/experiments/active" -Method Get
    Write-Host "  SUCCESS - Active experiment check working" -ForegroundColor Green
    Write-Host "  Has active experiment: $($active.active)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 14: Security - Permissions
Write-Host "[14] Security - Permissions List..." -ForegroundColor Yellow
try {
    $perms = Invoke-RestMethod -Uri "$BASE_URL/auth/permissions" -Method Get
    Write-Host "  SUCCESS - Permissions retrieved" -ForegroundColor Green
    Write-Host "  Available roles: $($perms.roles.Count)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 15: Security - Statistics
Write-Host "[15] Security Statistics..." -ForegroundColor Yellow
try {
    $security = Invoke-RestMethod -Uri "$BASE_URL/auth/security-stats" -Method Get
    Write-Host "  SUCCESS - Security stats retrieved" -ForegroundColor Green
    Write-Host "  Total users: $($security.total_users)" -ForegroundColor Gray
    Write-Host "  Active sessions: $($security.active_sessions)`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 16: API Documentation
Write-Host "[16] API Documentation..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "$BASE_URL/api/docs" -Method Get -UseBasicParsing | Out-Null
    Write-Host "  SUCCESS - API docs available" -ForegroundColor Green
    Write-Host "  URL: $BASE_URL/api/docs`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

# Test 17: Prometheus Metrics
Write-Host "[17] Prometheus Metrics..." -ForegroundColor Yellow
try {
    Invoke-WebRequest -Uri "$BASE_URL/metrics" -Method Get -UseBasicParsing | Out-Null
    Write-Host "  SUCCESS - Prometheus metrics endpoint working" -ForegroundColor Green
    Write-Host "  URL: $BASE_URL/metrics`n" -ForegroundColor Gray
} catch {
    Write-Host "  FAILED: $_`n" -ForegroundColor Red
}

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

Write-Host "Key URLs:" -ForegroundColor Yellow
Write-Host "  API Docs:    $BASE_URL/api/docs" -ForegroundColor Gray
Write-Host "  Health:      $BASE_URL/health" -ForegroundColor Gray
Write-Host "  Dashboard:   $BASE_URL/monitoring/dashboard" -ForegroundColor Gray
Write-Host "  Metrics:     $BASE_URL/metrics`n" -ForegroundColor Gray

Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "  1. Open $BASE_URL/api/docs in your browser" -ForegroundColor Gray
Write-Host "  2. Test file upload and analysis via the Swagger UI" -ForegroundColor Gray
Write-Host "  3. Create demo video or screenshots" -ForegroundColor Gray
Write-Host "  4. Update README with demo content" -ForegroundColor Gray
Write-Host "  5. Move to Phase 2: Cloud Deployment`n" -ForegroundColor Gray
