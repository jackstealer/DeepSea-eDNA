# Test Quality Control Features

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Quality Control & Confidence Alerts" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8000"

# Test 1: Get quality thresholds
Write-Host "1. Getting quality thresholds..." -ForegroundColor Yellow

try {
    $thresholds = Invoke-RestMethod -Uri "$baseUrl/quality/thresholds"
    
    Write-Host "  Quality Thresholds:" -ForegroundColor Green
    Write-Host "    High:     ≥$($thresholds.thresholds.high * 100)%" -ForegroundColor Green
    Write-Host "    Medium:   $($thresholds.thresholds.medium * 100)-$($thresholds.thresholds.high * 100)%" -ForegroundColor Yellow
    Write-Host "    Low:      $($thresholds.thresholds.low * 100)-$($thresholds.thresholds.medium * 100)%" -ForegroundColor Magenta
    Write-Host "    Critical: <$($thresholds.thresholds.critical * 100)%" -ForegroundColor Red
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Test detailed prediction with high-quality sequence
Write-Host "2. Testing with good quality sequence..." -ForegroundColor Yellow

$goodSequence = @{
    sequence = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAATTGGCCAATTGGCCAATTGGCCAA"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/predict/detailed" -Method Post `
        -Body $goodSequence -ContentType "application/json"
    
    Write-Host "  Prediction: $($result.class_name) ($($result.common_name))" -ForegroundColor White
    Write-Host "  Confidence: $($result.confidence.ToString('P2'))" -ForegroundColor Cyan
    Write-Host "  Quality Level: $($result.quality_level.ToUpper())" -ForegroundColor $(
        switch ($result.quality_level) {
            "high" { "Green" }
            "medium" { "Yellow" }
            "low" { "Magenta" }
            "critical" { "Red" }
            default { "White" }
        }
    )
    Write-Host "  Recommendation: $($result.recommendation)" -ForegroundColor Cyan
    Write-Host "  Alert Triggered: $($result.alert_triggered)" -ForegroundColor $(if ($result.alert_triggered) { "Red" } else { "Green" })
    Write-Host "  Ambiguous: $($result.is_ambiguous)" -ForegroundColor $(if ($result.is_ambiguous) { "Yellow" } else { "White" })
    
    if ($result.warnings.Count -gt 0) {
        Write-Host "  Warnings:" -ForegroundColor Yellow
        foreach ($warning in $result.warnings) {
            Write-Host "    - $warning" -ForegroundColor Yellow
        }
    }
    
    if ($result.alternative_predictions.Count -gt 0) {
        Write-Host "  Alternative Predictions:" -ForegroundColor Cyan
        foreach ($alt in $result.alternative_predictions) {
            Write-Host "    - $($alt.class_name): $([math]::Round($alt.probability * 100, 2))%" -ForegroundColor White
        }
    }
    
    Write-Host "  Sequence Quality:" -ForegroundColor Cyan
    Write-Host "    Length: $($result.sequence_quality.length) bp" -ForegroundColor White
    Write-Host "    GC Content: $($result.sequence_quality.gc_content)%" -ForegroundColor White
    Write-Host "    N Content: $($result.sequence_quality.n_percentage)%" -ForegroundColor White
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Test with short sequence (lower quality)
Write-Host "3. Testing with short/low-quality sequence..." -ForegroundColor Yellow

$shortSequence = @{
    sequence = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"
} | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/predict/detailed" -Method Post `
        -Body $shortSequence -ContentType "application/json"
    
    Write-Host "  Prediction: $($result.class_name)" -ForegroundColor White
    Write-Host "  Confidence: $($result.confidence.ToString('P2'))" -ForegroundColor Cyan
    Write-Host "  Quality Level: $($result.quality_level.ToUpper())" -ForegroundColor $(
        switch ($result.quality_level) {
            "high" { "Green" }
            "medium" { "Yellow" }
            "low" { "Magenta" }
            "critical" { "Red" }
            default { "White" }
        }
    )
    
    if ($result.warnings.Count -gt 0) {
        Write-Host "  ⚠️  Warnings ($($result.warnings.Count)):" -ForegroundColor Yellow
        foreach ($warning in $result.warnings) {
            Write-Host "    $warning" -ForegroundColor Yellow
        }
    }
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Make multiple predictions to build statistics
Write-Host "4. Making multiple predictions for statistics..." -ForegroundColor Yellow

$testSequences = @(
    "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAATTGGCCAATTGGCCAATTGGCCAA",
    "GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGC",
    "TTAGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGC",
    "CCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAATTCCGGAA",
    "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"
)

$count = 0
foreach ($seq in $testSequences) {
    try {
        $body = @{ sequence = $seq } | ConvertTo-Json
        $result = Invoke-RestMethod -Uri "$baseUrl/predict" -Method Post -Body $body -ContentType "application/json"
        $count++
    } catch {
        # Ignore errors for this test
    }
}

Write-Host "  ✓ Made $count predictions" -ForegroundColor Green

Write-Host ""

# Test 5: Get quality statistics
Write-Host "5. Getting quality statistics..." -ForegroundColor Yellow

try {
    $stats = Invoke-RestMethod -Uri "$baseUrl/quality/stats?days=1"
    
    Write-Host "  Period: $($stats.period_days) day(s)" -ForegroundColor White
    Write-Host "  Total Predictions: $($stats.total_predictions)" -ForegroundColor Cyan
    Write-Host "  Average Confidence: $($stats.average_confidence.ToString('P2'))" -ForegroundColor White
    Write-Host "  Alerts Triggered: $($stats.alerts_triggered) ($($stats.alert_rate)%)" -ForegroundColor $(if ($stats.alert_rate -gt 20) { "Red" } else { "Yellow" })
    
    Write-Host ""
    Write-Host "  Quality Distribution:" -ForegroundColor Cyan
    Write-Host "    High:     $($stats.quality_distribution.high.count) ($($stats.quality_distribution.high.percentage)%)" -ForegroundColor Green
    Write-Host "    Medium:   $($stats.quality_distribution.medium.count) ($($stats.quality_distribution.medium.percentage)%)" -ForegroundColor Yellow
    Write-Host "    Low:      $($stats.quality_distribution.low.count) ($($stats.quality_distribution.low.percentage)%)" -ForegroundColor Magenta
    Write-Host "    Critical: $($stats.quality_distribution.critical.count) ($($stats.quality_distribution.critical.percentage)%)" -ForegroundColor Red
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 6: Get low confidence predictions
Write-Host "6. Getting low-confidence predictions..." -ForegroundColor Yellow

try {
    $lowConf = Invoke-RestMethod -Uri "$baseUrl/quality/low-confidence?limit=10"
    
    Write-Host "  Found: $($lowConf.total) predictions below $($lowConf.threshold * 100)% confidence" -ForegroundColor Yellow
    
    if ($lowConf.total -gt 0) {
        Write-Host ""
        Write-Host "  Predictions needing review:" -ForegroundColor Cyan
        foreach ($pred in $lowConf.predictions | Select-Object -First 5) {
            Write-Host "    ID $($pred.id): $($pred.class_name) - $($pred.confidence.ToString('P2')) [$($pred.quality_level)]" -ForegroundColor White
        }
    } else {
        Write-Host "  ✓ No low-confidence predictions found!" -ForegroundColor Green
    }
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 7: Compare basic vs detailed prediction
Write-Host "7. Comparing basic vs detailed prediction..." -ForegroundColor Yellow

$testSeq = @{ sequence = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGAATTGGCCAATTGGCCAATTGGCCAA" } | ConvertTo-Json

try {
    Write-Host "  Basic Prediction:" -ForegroundColor Cyan
    $start = Get-Date
    $basic = Invoke-RestMethod -Uri "$baseUrl/predict" -Method Post -Body $testSeq -ContentType "application/json"
    $basicTime = ((Get-Date) - $start).TotalMilliseconds
    Write-Host "    Result: $($basic.class_name)" -ForegroundColor White
    Write-Host "    Time: $($basicTime.ToString('F2')) ms" -ForegroundColor White
    
    Write-Host ""
    Write-Host "  Detailed Prediction:" -ForegroundColor Cyan
    $start = Get-Date
    $detailed = Invoke-RestMethod -Uri "$baseUrl/predict/detailed" -Method Post -Body $testSeq -ContentType "application/json"
    $detailedTime = ((Get-Date) - $start).TotalMilliseconds
    Write-Host "    Result: $($detailed.class_name)" -ForegroundColor White
    Write-Host "    Quality: $($detailed.quality_level)" -ForegroundColor Green
    Write-Host "    Alternatives: $($detailed.alternative_predictions.Count)" -ForegroundColor White
    Write-Host "    Time: $($detailedTime.ToString('F2')) ms" -ForegroundColor White
    
    Write-Host ""
    Write-Host "  Additional info in detailed endpoint:" -ForegroundColor Yellow
    Write-Host "    + Quality assessment" -ForegroundColor White
    Write-Host "    + Alternative predictions" -ForegroundColor White
    Write-Host "    + Sequence quality analysis" -ForegroundColor White
    Write-Host "    + Warning system" -ForegroundColor White
    Write-Host "    + Recommendations" -ForegroundColor White
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Quality Control Testing Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "New Endpoints:" -ForegroundColor Cyan
Write-Host "  POST /predict/detailed - Prediction with quality analysis" -ForegroundColor White
Write-Host "  GET /quality/thresholds - View quality thresholds" -ForegroundColor White
Write-Host "  GET /quality/stats - Quality statistics" -ForegroundColor White
Write-Host "  GET /quality/low-confidence - Review low-confidence predictions" -ForegroundColor White
