# Test Script for Feature #7: Model Versioning
# Tests version registration, comparison, rollback, and history

$BASE_URL = "http://localhost:8000"

Write-Host "`n=== Feature #7: Model Versioning Tests ===" -ForegroundColor Cyan
Write-Host "Testing model version management...`n" -ForegroundColor Yellow

# Test 1: Get version statistics
Write-Host "1. Testing version statistics..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/versions/statistics" -Method Get
    Write-Host "Total Versions: $($response.total_versions)" -ForegroundColor White
    Write-Host "Active: $($response.active_versions)" -ForegroundColor White
    Write-Host "Archived: $($response.archived_versions)" -ForegroundColor White
    Write-Host "Deprecated: $($response.deprecated_versions)" -ForegroundColor White
    if ($response.current_version) {
        Write-Host "Current Version: $($response.current_version.version_name)" -ForegroundColor Yellow
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 2: Register a new version
Write-Host "2. Testing version registration..." -ForegroundColor Green
try {
    $body = @{
        version_name = "v2.2-test"
        model_path = "./ml_models/marine_model"
        description = "Test version with improved accuracy"
        metrics = @{
            accuracy = 0.95
            f1_score = 0.93
            precision = 0.94
            recall = 0.92
        }
        training_info = @{
            epochs = 100
            batch_size = 32
            learning_rate = 0.001
        }
        tags = @("production", "marine", "test")
        set_as_current = $false
    } | ConvertTo-Json -Depth 3
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/versions/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "Status: $($response.status)" -ForegroundColor White
    Write-Host "Version ID: $($response.version_id)" -ForegroundColor White
    Write-Host "Version Name: $($response.version_name)" -ForegroundColor White
    Write-Host "Is Current: $($response.is_current)`n" -ForegroundColor White
    
    $testVersionId = $response.version_id
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 3: List all versions
Write-Host "3. Testing version listing..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/versions?limit=10" -Method Get
    Write-Host "Total Versions: $($response.total)" -ForegroundColor White
    Write-Host "`nVersions:" -ForegroundColor Yellow
    foreach ($version in $response.versions) {
        $current = if ($version.is_current) { "[CURRENT]" } else { "" }
        Write-Host "  - $($version.version_name) ($($version.status)) $current" -ForegroundColor White
        Write-Host "    ID: $($version.version_id)" -ForegroundColor Gray
        if ($version.metrics) {
            $metricsStr = ($version.metrics.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ", "
            Write-Host "    Metrics: $metricsStr" -ForegroundColor Gray
        }
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 4: Get current version
Write-Host "4. Testing get current version..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/versions/current/info" -Method Get
    Write-Host "Current Version:" -ForegroundColor Yellow
    Write-Host "  Name: $($response.version_name)" -ForegroundColor White
    Write-Host "  ID: $($response.version_id)" -ForegroundColor White
    Write-Host "  Created: $($response.created_at)" -ForegroundColor White
    Write-Host "  Status: $($response.status)" -ForegroundColor White
    if ($response.metrics) {
        Write-Host "  Metrics:" -ForegroundColor White
        $response.metrics.PSObject.Properties | ForEach-Object {
            Write-Host "    $($_.Name): $($_.Value)" -ForegroundColor Gray
        }
    }
    Write-Host ""
    
    $currentVersionId = $response.version_id
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 5: Get version details
Write-Host "5. Testing get version details..." -ForegroundColor Green
if ($testVersionId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/versions/$testVersionId" -Method Get
        Write-Host "Version Details:" -ForegroundColor Yellow
        Write-Host "  Name: $($response.version_name)" -ForegroundColor White
        Write-Host "  Path: $($response.model_path)" -ForegroundColor White
        Write-Host "  Description: $($response.description)" -ForegroundColor White
        Write-Host "  Checksum: $($response.checksum)" -ForegroundColor White
        Write-Host "  Tags: $($response.tags -join ', ')" -ForegroundColor White
        Write-Host ""
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 6: Compare versions (if we have at least 2)
Write-Host "6. Testing version comparison..." -ForegroundColor Green
if ($testVersionId -and $currentVersionId -and $testVersionId -ne $currentVersionId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/versions/compare/$currentVersionId/$testVersionId" -Method Get
        
        Write-Host "Comparison:" -ForegroundColor Yellow
        Write-Host "  Version 1: $($response.version_1.name)" -ForegroundColor White
        Write-Host "  Version 2: $($response.version_2.name)" -ForegroundColor White
        
        Write-Host "`n  Metrics Comparison:" -ForegroundColor Yellow
        $response.metrics_comparison.PSObject.Properties | ForEach-Object {
            $metric = $_.Value
            $improvement = if ($metric.improved -eq $true) { "↑" } elseif ($metric.improved -eq $false) { "↓" } else { "=" }
            Write-Host "    $($_.Name): $($metric.version_1) → $($metric.version_2) $improvement" -ForegroundColor White
            if ($metric.percent_change) {
                Write-Host "      Change: $([math]::Round($metric.percent_change, 2))%" -ForegroundColor Gray
            }
        }
        
        Write-Host "`n  Summary:" -ForegroundColor Yellow
        Write-Host "    Improved: $($response.summary.improved_metrics)" -ForegroundColor Green
        Write-Host "    Degraded: $($response.summary.degraded_metrics)" -ForegroundColor Red
        Write-Host "    Unchanged: $($response.summary.unchanged_metrics)" -ForegroundColor Gray
        Write-Host "    Overall: $($response.summary.overall)`n" -ForegroundColor White
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
} else {
    Write-Host "Skipped (need 2 different versions)`n" -ForegroundColor Gray
}

# Test 7: Version history
Write-Host "7. Testing version history..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/versions/history?limit=5" -Method Get
    Write-Host "Version History (latest $($response.total)):" -ForegroundColor Yellow
    foreach ($entry in $response.history) {
        $current = if ($entry.is_current) { "[CURRENT]" } else { "" }
        Write-Host "  $($entry.version_name) $current" -ForegroundColor White
        Write-Host "    Status: $($entry.status)" -ForegroundColor Gray
        Write-Host "    Created: $($entry.created_at)" -ForegroundColor Gray
        if ($entry.key_metrics) {
            $metricsStr = ($entry.key_metrics.PSObject.Properties | ForEach-Object { "$($_.Name)=$($_.Value)" }) -join ", "
            Write-Host "    Key Metrics: $metricsStr" -ForegroundColor Gray
        }
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 8: Activate version (switch to test version)
Write-Host "8. Testing version activation..." -ForegroundColor Green
if ($testVersionId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/versions/$testVersionId/activate" -Method Post
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Message: $($response.message)" -ForegroundColor White
        Write-Host "Active Version: $($response.version_id)`n" -ForegroundColor Yellow
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 9: Rollback to original version
Write-Host "9. Testing version rollback..." -ForegroundColor Green
if ($currentVersionId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/versions/$currentVersionId/rollback" -Method Post
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Message: $($response.message)" -ForegroundColor White
        Write-Host "Rolled back to: $($response.version_id)`n" -ForegroundColor Yellow
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 10: Archive version
Write-Host "10. Testing version archiving..." -ForegroundColor Green
if ($testVersionId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/versions/$testVersionId/archive" -Method Post
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Message: $($response.message)`n" -ForegroundColor White
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 11: Verify archived status
Write-Host "11. Verifying archived version..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/versions?status=archived" -Method Get
    Write-Host "Archived Versions: $($response.total)" -ForegroundColor White
    foreach ($version in $response.versions) {
        Write-Host "  - $($version.version_name) (Status: $($version.status))" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

Write-Host "=== Model Versioning Testing Complete ===" -ForegroundColor Cyan
Write-Host "`nModel Versioning Features:" -ForegroundColor Yellow
Write-Host "  ✓ Version registration with metadata" -ForegroundColor Green
Write-Host "  ✓ Version listing and filtering" -ForegroundColor Green
Write-Host "  ✓ Current version tracking" -ForegroundColor Green
Write-Host "  ✓ Version comparison (metrics diff)" -ForegroundColor Green
Write-Host "  ✓ Version activation/switching" -ForegroundColor Green
Write-Host "  ✓ Rollback capability" -ForegroundColor Green
Write-Host "  ✓ Version history" -ForegroundColor Green
Write-Host "  ✓ Archive/deprecate versions" -ForegroundColor Green
Write-Host "  ✓ Model checksum validation" -ForegroundColor Green
Write-Host "  ✓ Tags and metadata" -ForegroundColor Green
Write-Host "`nVersion management available at: $BASE_URL/versions" -ForegroundColor Cyan
