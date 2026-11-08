# Phase 1: Local Testing & Verification
# Tests all 15 MLOps features systematically

$BASE_URL = "http://localhost:8000"
$DEMO_FILE = "demo_sequences.fasta"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 1: Local Testing & Verification" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health Check
Write-Host "[1/15] Testing Health Check..." -ForegroundColor Yellow
try {
    $health = Invoke-RestMethod -Uri "$BASE_URL/health" -Method Get
    Write-Host "Success - Health Status: $($health.status)" -ForegroundColor Green
    Write-Host "  Model: $($health.model_info.model_name)" -ForegroundColor Gray
    Write-Host "  Version: $($health.model_info.version)" -ForegroundColor Gray
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 2: Model Versioning
Write-Host "[2/15] Testing Model Versioning..." -ForegroundColor Yellow
try {
    $versions = Invoke-RestMethod -Uri "$BASE_URL/api/models/versions" -Method Get
    Write-Host "Success - Available versions: $($versions.Count)" -ForegroundColor Green
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 3: Metrics Dashboard
Write-Host "[3/15] Testing Metrics Dashboard..." -ForegroundColor Yellow
try {
    $metrics = Invoke-RestMethod -Uri "$BASE_URL/api/monitoring/metrics" -Method Get
    Write-Host "Success - Metrics retrieved" -ForegroundColor Green
    Write-Host "  Total predictions: $($metrics.total_predictions)" -ForegroundColor Gray
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 4: System Health
Write-Host "[4/15] Testing System Health..." -ForegroundColor Yellow
try {
    $system = Invoke-RestMethod -Uri "$BASE_URL/api/monitoring/health" -Method Get
    Write-Host "Success - System health retrieved" -ForegroundColor Green
    Write-Host "  CPU: $($system.cpu_percent)%" -ForegroundColor Gray
    Write-Host "  Memory: $($system.memory_percent)%" -ForegroundColor Gray
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 5: Cache Management
Write-Host "[5/15] Testing Cache Management..." -ForegroundColor Yellow
try {
    $cache = Invoke-RestMethod -Uri "$BASE_URL/api/cache/stats" -Method Get
    Write-Host "Success - Cache stats retrieved" -ForegroundColor Green
    Write-Host "  Backend: $($cache.backend)" -ForegroundColor Gray
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 6: API Documentation
Write-Host "[6/15] Testing API Documentation..." -ForegroundColor Yellow
try {
    Invoke-RestMethod -Uri "$BASE_URL/docs" -Method Get -ErrorAction Stop | Out-Null
    Write-Host "Success - API docs available at $BASE_URL/docs" -ForegroundColor Green
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 7: Model Performance
Write-Host "[7/15] Testing Model Performance Tracking..." -ForegroundColor Yellow
try {
    $performance = Invoke-RestMethod -Uri "$BASE_URL/api/models/performance" -Method Get
    Write-Host "Success - Performance metrics retrieved" -ForegroundColor Green
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 8: Audit Logging
Write-Host "[8/15] Testing Audit Logging..." -ForegroundColor Yellow
try {
    $logs = Invoke-RestMethod -Uri "$BASE_URL/api/audit/logs?limit=5" -Method Get
    Write-Host "Success - Audit logs retrieved" -ForegroundColor Green
    Write-Host "  Recent logs: $($logs.Count)" -ForegroundColor Gray
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 9: A/B Testing
Write-Host "[9/15] Testing A/B Testing Framework..." -ForegroundColor Yellow
try {
    $experiments = Invoke-RestMethod -Uri "$BASE_URL/api/experiments" -Method Get
    Write-Host "Success - A/B testing available" -ForegroundColor Green
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 10: Feedback System
Write-Host "[10/15] Testing Feedback System..." -ForegroundColor Yellow
try {
    $feedback = @{
        prediction_id = "test_pred_123"
        rating = 5
        comment = "Excellent prediction!"
    } | ConvertTo-Json
    
    Invoke-RestMethod -Uri "$BASE_URL/api/feedback" -Method Post -Body $feedback -ContentType "application/json" | Out-Null
    Write-Host "Success - Feedback submitted" -ForegroundColor Green
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 11: Data Validation
Write-Host "[11/15] Testing Data Validation..." -ForegroundColor Yellow
try {
    $validation = @{
        sequence = "ATCGATCGATCG"
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/validate" -Method Post -Body $validation -ContentType "application/json"
    Write-Host "Success - Data validation working" -ForegroundColor Green
    Write-Host "  Valid: $($result.is_valid)" -ForegroundColor Gray
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 12: Batch Processing
Write-Host "[12/15] Testing Batch Processing..." -ForegroundColor Yellow
try {
    $batch = @{
        sequences = @("ATCGATCG", "GCTAGCTA", "TTAACCGG")
    } | ConvertTo-Json
    
    $result = Invoke-RestMethod -Uri "$BASE_URL/api/batch/predict" -Method Post -Body $batch -ContentType "application/json"
    Write-Host "Success - Batch processing working" -ForegroundColor Green
    Write-Host "  Processed: $($result.results.Count) sequences" -ForegroundColor Gray
} catch {
    Write-Host "Failed: $_" -ForegroundColor Red
}
Write-Host ""

# Test 13: File Upload
Write-Host "[13/15] Testing File Upload..." -ForegroundColor Yellow
if (Test-Path $DEMO_FILE) {
    try {
        $boundary = [System.Guid]::NewGuid().ToString()
        $headers = @{"Content-Type" = "multipart/form-data; boundary=$boundary"}
        $fileBytes = [System.IO.File]::ReadAllBytes($DEMO_FILE)
        $fileContent = [System.Text.Encoding]::GetEncoding("iso-8859-1").GetString($fileBytes)
        
        $body = @"
--$boundary
Content-Disposition: form-data; name="file"; filename="$DEMO_FILE"
Content-Type: application/octet-stream

$fileContent
--$boundary--
"@
        
        $upload = Invoke-RestMethod -Uri "$BASE_URL/api/upload" -Method Post -Headers $headers -Body $body
        Write-Host "Success - File uploaded" -ForegroundColor Green
        Write-Host "  File ID: $($upload.file_id)" -ForegroundColor Gray
        $global:FILE_ID = $upload.file_id
    } catch {
        Write-Host "Failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped - Demo file not found" -ForegroundColor Yellow
}
Write-Host ""

# Test 14: Sequence Analysis
Write-Host "[14/15] Testing Sequence Analysis..." -ForegroundColor Yellow
if ($global:FILE_ID) {
    try {
        $analysis = Invoke-RestMethod -Uri "$BASE_URL/api/analyze/$($global:FILE_ID)" -Method Post
        Write-Host "Success - Analysis completed" -ForegroundColor Green
        Write-Host "  Sequences processed: $($analysis.results.Count)" -ForegroundColor Gray
    } catch {
        Write-Host "Failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped - No file uploaded" -ForegroundColor Yellow
}
Write-Host ""

# Test 15: Export Results
Write-Host "[15/15] Testing Export Results..." -ForegroundColor Yellow
if ($global:FILE_ID) {
    try {
        Invoke-RestMethod -Uri "$BASE_URL/api/export/$($global:FILE_ID)" -Method Get -OutFile "test_export.csv"
        Write-Host "Success - Results exported to test_export.csv" -ForegroundColor Green
    } catch {
        Write-Host "Failed: $_" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped - No analysis results" -ForegroundColor Yellow
}
Write-Host ""

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Phase 1 Testing Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Yellow
Write-Host "1. Review test results above" -ForegroundColor Gray
Write-Host "2. Check test_export.csv for sample results" -ForegroundColor Gray
Write-Host "3. Visit http://localhost:8000/docs for API documentation" -ForegroundColor Gray
Write-Host "4. Prepare demo video or screenshots" -ForegroundColor Gray
Write-Host "5. Move to Phase 2: Cloud Deployment" -ForegroundColor Gray
Write-Host ""
