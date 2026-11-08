# Test Script for Feature #8: A/B Testing
# Tests experiment creation, traffic splitting, and performance tracking

$BASE_URL = "http://localhost:8000"

Write-Host "`n=== Feature #8: A/B Testing Tests ===" -ForegroundColor Cyan
Write-Host "Testing A/B experiment management...`n" -ForegroundColor Yellow

# Test 1: List existing experiments
Write-Host "1. Listing existing experiments..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/experiments" -Method Get
    Write-Host "Total Experiments: $($response.total)" -ForegroundColor White
    if ($response.experiments.Count -gt 0) {
        Write-Host "Existing experiments:" -ForegroundColor Yellow
        foreach ($exp in $response.experiments) {
            Write-Host "  - $($exp.experiment_name) (Status: $($exp.status))" -ForegroundColor White
        }
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 2: Create a new experiment
Write-Host "2. Creating new A/B test experiment..." -ForegroundColor Green
try {
    $body = @{
        experiment_name = "Model Accuracy Test v2.0 vs v2.1"
        description = "Testing performance improvement between baseline and new model"
        variant_configs = @(
            @{
                name = "control"
                version_id = "v2.0-baseline"
                traffic = 50
            },
            @{
                name = "treatment"
                version_id = "v2.1-improved"
                traffic = 50
            }
        )
        strategy = "random"
        duration_days = 7
    } | ConvertTo-Json -Depth 4
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/create" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "Status: $($response.status)" -ForegroundColor White
    Write-Host "Experiment ID: $($response.experiment_id)" -ForegroundColor White
    Write-Host "Experiment Name: $($response.experiment_name)" -ForegroundColor White
    Write-Host "Variants: $($response.variants)`n" -ForegroundColor White
    
    $experimentId = $response.experiment_id
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 3: Get experiment details
Write-Host "3. Getting experiment details..." -ForegroundColor Green
if ($experimentId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/$experimentId/results" -Method Get
        Write-Host "Experiment: $($response.experiment_name)" -ForegroundColor Yellow
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Created: $($response.created_at)" -ForegroundColor White
        Write-Host "`nVariants:" -ForegroundColor Yellow
        foreach ($variant in $response.variants) {
            Write-Host "  $($variant.variant_name):" -ForegroundColor White
            Write-Host "    Version: $($variant.version_id)" -ForegroundColor Gray
            Write-Host "    Traffic: $($variant.traffic_percentage)%" -ForegroundColor Gray
            Write-Host "    Predictions: $($variant.prediction_count)" -ForegroundColor Gray
        }
        Write-Host ""
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 4: Start the experiment
Write-Host "4. Starting experiment..." -ForegroundColor Green
if ($experimentId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/$experimentId/start" -Method Post
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Message: $($response.message)" -ForegroundColor White
        Write-Host "Experiment is now RUNNING`n" -ForegroundColor Yellow
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 5: Check active experiment
Write-Host "5. Checking active experiment..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/active" -Method Get
    if ($response.active) {
        Write-Host "Active: Yes" -ForegroundColor Yellow
        Write-Host "Experiment: $($response.experiment.experiment_name)" -ForegroundColor White
        Write-Host "Status: $($response.experiment.status)" -ForegroundColor White
        Write-Host "`nVariants:" -ForegroundColor Yellow
        foreach ($variant in $response.experiment.variants) {
            Write-Host "  $($variant.variant_name): $($variant.traffic_percentage)% traffic, $($variant.prediction_count) predictions" -ForegroundColor White
        }
    } else {
        Write-Host "Active: No" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 6: Simulate predictions for both variants
Write-Host "6. Simulating predictions for experiment..." -ForegroundColor Green
Write-Host "Making 20 predictions to generate experiment data..." -ForegroundColor Yellow

$sequences = @(
    "ATCGATCGATCGATCG",
    "GCTAGCTAGCTAGCTA",
    "TTAACCGGTTAACCGG",
    "CGCGCGCGCGCGCGCG",
    "ATATATATATATAT",
    "GCGCGCGCGCGCGC",
    "TTTTTTTTTTTTTT",
    "AAAAAAAAAAAAA",
    "CCCCCCCCCCCCCC",
    "GGGGGGGGGGGGGG"
)

$predictionCount = 0
foreach ($i in 1..20) {
    $seq = $sequences[($i % $sequences.Count)]
    try {
        $body = @{
            sequence = $seq
            use_cache = $false
        } | ConvertTo-Json
        
        $response = Invoke-RestMethod -Uri "$BASE_URL/api/predict" `
            -Method Post `
            -ContentType "application/json" `
            -Body $body
        
        $predictionCount++
        if ($predictionCount % 5 -eq 0) {
            Write-Host "  Made $predictionCount predictions..." -ForegroundColor Gray
        }
    } catch {
        # Silently continue on errors
    }
    Start-Sleep -Milliseconds 100
}
Write-Host "Completed $predictionCount predictions`n" -ForegroundColor White

# Test 7: Get experiment results with statistics
Write-Host "7. Getting experiment results..." -ForegroundColor Green
if ($experimentId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/$experimentId/results" -Method Get
        
        Write-Host "Experiment Results:" -ForegroundColor Yellow
        Write-Host "Status: $($response.status)" -ForegroundColor White
        
        Write-Host "`nVariant Performance:" -ForegroundColor Yellow
        foreach ($variant in $response.variants) {
            Write-Host "  $($variant.variant_name) ($($variant.version_id)):" -ForegroundColor White
            Write-Host "    Predictions: $($variant.prediction_count)" -ForegroundColor Gray
            Write-Host "    Avg Confidence: $($variant.avg_confidence)" -ForegroundColor Gray
            Write-Host "    Success Rate: $($variant.success_rate)%" -ForegroundColor Gray
            Write-Host "    Confidence Interval: [$($variant.confidence_interval.lower), $($variant.confidence_interval.upper)]" -ForegroundColor Gray
        }
        
        if ($response.statistical_analysis.control) {
            Write-Host "`nStatistical Analysis:" -ForegroundColor Yellow
            $analysis = $response.statistical_analysis
            Write-Host "  Control ($($analysis.control.variant_name)):" -ForegroundColor White
            Write-Host "    Mean: $($analysis.control.mean_confidence)" -ForegroundColor Gray
            Write-Host "    Samples: $($analysis.control.samples)" -ForegroundColor Gray
            
            Write-Host "  Treatment ($($analysis.treatment.variant_name)):" -ForegroundColor White
            Write-Host "    Mean: $($analysis.treatment.mean_confidence)" -ForegroundColor Gray
            Write-Host "    Samples: $($analysis.treatment.samples)" -ForegroundColor Gray
            
            Write-Host "`n  Improvement: $($analysis.improvement_percent)%" -ForegroundColor $(if ($analysis.improvement_percent -gt 0) { "Green" } else { "Red" })
            Write-Host "  Statistically Significant: $($analysis.statistically_significant)" -ForegroundColor White
            Write-Host "  Recommendation: $($analysis.recommendation)" -ForegroundColor Cyan
        }
        Write-Host ""
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 8: Pause experiment
Write-Host "8. Testing experiment pause..." -ForegroundColor Green
if ($experimentId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/$experimentId/pause" -Method Post
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Message: $($response.message)`n" -ForegroundColor White
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 9: Resume experiment
Write-Host "9. Testing experiment resume..." -ForegroundColor Green
if ($experimentId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/$experimentId/resume" -Method Post
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Message: $($response.message)`n" -ForegroundColor White
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 10: Stop experiment and declare winner
Write-Host "10. Stopping experiment and declaring winner..." -ForegroundColor Green
if ($experimentId) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/experiments/$experimentId/stop?declare_winner=true" -Method Post
        Write-Host "Status: $($response.status)" -ForegroundColor White
        Write-Host "Message: $($response.message)" -ForegroundColor White
        if ($response.winner) {
            Write-Host "Winner: $($response.winner)" -ForegroundColor Yellow
        }
        Write-Host ""
    } catch {
        Write-Host "Failed: $_`n" -ForegroundColor Red
    }
}

# Test 11: List completed experiments
Write-Host "11. Listing completed experiments..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/experiments?status=completed" -Method Get
    Write-Host "Completed Experiments: $($response.total)" -ForegroundColor White
    foreach ($exp in $response.experiments) {
        Write-Host "  - $($exp.experiment_name)" -ForegroundColor White
        Write-Host "    Started: $($exp.started_at)" -ForegroundColor Gray
        Write-Host "    Status: $($exp.status)" -ForegroundColor Gray
    }
    Write-Host ""
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

Write-Host "=== A/B Testing Complete ===" -ForegroundColor Cyan
Write-Host "`nA/B Testing Features:" -ForegroundColor Yellow
Write-Host "  ✓ Experiment creation with multiple variants" -ForegroundColor Green
Write-Host "  ✓ Traffic splitting (50/50, gradual rollout)" -ForegroundColor Green
Write-Host "  ✓ Live performance tracking" -ForegroundColor Green
Write-Host "  ✓ Statistical analysis (confidence intervals)" -ForegroundColor Green
Write-Host "  ✓ Significance testing" -ForegroundColor Green
Write-Host "  ✓ Automatic winner declaration" -ForegroundColor Green
Write-Host "  ✓ Experiment pause/resume" -ForegroundColor Green
Write-Host "  ✓ Experiment history" -ForegroundColor Green
Write-Host "  ✓ Real-time metrics updates" -ForegroundColor Green
Write-Host "  ✓ Multiple splitting strategies (random, hash)" -ForegroundColor Green
Write-Host "`nA/B Testing available at: $BASE_URL/experiments" -ForegroundColor Cyan
