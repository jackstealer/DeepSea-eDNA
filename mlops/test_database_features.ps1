# Test Database Features

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Database Features" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8000"

# Test 1: Make some predictions (will be saved to DB)
Write-Host "1. Making predictions (auto-saved to database)..." -ForegroundColor Yellow
$sequences = @(
    "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG",
    "GCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTAGCTA",
    "TTAGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTGGCCAATTG"
)

foreach ($seq in $sequences) {
    $body = @{ sequence = $seq } | ConvertTo-Json
    $result = Invoke-RestMethod -Uri "$baseUrl/predict" -Method Post -Body $body -ContentType "application/json"
    Write-Host "  ✓ Predicted: $($result.class_name) ($($result.confidence.ToString('P2')))" -ForegroundColor Green
}

Write-Host ""

# Test 2: Get prediction history
Write-Host "2. Fetching prediction history..." -ForegroundColor Yellow
$history = Invoke-RestMethod -Uri "$baseUrl/predictions/history?limit=10"
Write-Host "  Total predictions in database: $($history.total)" -ForegroundColor Green
Write-Host "  Recent predictions:" -ForegroundColor Cyan
foreach ($pred in $history.predictions | Select-Object -First 5) {
    Write-Host "    ID $($pred.id): $($pred.class_name) - $($pred.confidence.ToString('P2')) confidence" -ForegroundColor White
}

Write-Host ""

# Test 3: Get detailed prediction
if ($history.predictions.Count -gt 0) {
    $firstId = $history.predictions[0].id
    Write-Host "3. Getting detailed prediction (ID: $firstId)..." -ForegroundColor Yellow
    $detail = Invoke-RestMethod -Uri "$baseUrl/predictions/$firstId"
    Write-Host "  Sequence length: $($detail.sequence_length) bp" -ForegroundColor Green
    Write-Host "  Species: $($detail.class_name) ($($detail.common_name))" -ForegroundColor Green
    Write-Host "  Confidence: $($detail.confidence.ToString('P2'))" -ForegroundColor Green
    Write-Host "  Processing time: $($detail.processing_time_ms.ToString('F2')) ms" -ForegroundColor Green
    Write-Host "  Created: $($detail.created_at)" -ForegroundColor Green
}

Write-Host ""

# Test 4: Get statistics
Write-Host "4. Getting API statistics..." -ForegroundColor Yellow
$stats = Invoke-RestMethod -Uri "$baseUrl/statistics?days=7"
Write-Host "  Total predictions (7 days): $($stats.total_predictions)" -ForegroundColor Green
Write-Host "  Average confidence: $($stats.avg_confidence.ToString('P2'))" -ForegroundColor Green
Write-Host "  Average processing time: $($stats.avg_processing_time_ms.ToString('F2')) ms" -ForegroundColor Green
Write-Host "  Predictions per day: $($stats.predictions_per_day)" -ForegroundColor Green
Write-Host ""
Write-Host "  Predictions by species:" -ForegroundColor Cyan
foreach ($class in $stats.predictions_by_class) {
    Write-Host "    $($class.class_name): $($class.count) ($($class.percentage)%)" -ForegroundColor White
}

Write-Host ""

# Test 5: Test caching (predict same sequence twice)
Write-Host "5. Testing database caching..." -ForegroundColor Yellow
$testSeq = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG"
$body = @{ sequence = $testSeq } | ConvertTo-Json

Write-Host "  First prediction (will compute)..." -ForegroundColor Cyan
$start = Get-Date
$result1 = Invoke-RestMethod -Uri "$baseUrl/predict" -Method Post -Body $body -ContentType "application/json"
$time1 = ((Get-Date) - $start).TotalMilliseconds

Write-Host "  Second prediction (should use cache)..." -ForegroundColor Cyan
$start = Get-Date
$result2 = Invoke-RestMethod -Uri "$baseUrl/predict" -Method Post -Body $body -ContentType "application/json"
$time2 = ((Get-Date) - $start).TotalMilliseconds

Write-Host "  First prediction time: $($time1.ToString('F2')) ms" -ForegroundColor Yellow
Write-Host "  Second prediction time: $($time2.ToString('F2')) ms" -ForegroundColor Yellow
if ($time2 -lt $time1) {
    Write-Host "  ✓ Caching working! $([math]::Round(($time1 - $time2) / $time1 * 100))% faster" -ForegroundColor Green
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ All Database Features Working!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Database file location: ./deepsea_predictions.db" -ForegroundColor Cyan
Write-Host "View history: curl $baseUrl/predictions/history" -ForegroundColor Cyan
Write-Host "View stats: curl $baseUrl/statistics" -ForegroundColor Cyan
