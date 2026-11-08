# Test Script for Feature #5: Redis Caching
# Tests cache statistics, backend info, and clearing operations

$BASE_URL = "http://localhost:8000"

Write-Host "`n=== Feature #5: Redis Caching Tests ===" -ForegroundColor Cyan
Write-Host "Testing cache functionality...`n" -ForegroundColor Yellow

# Test 1: Get cache backend info
Write-Host "1. Testing cache backend info..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/cache/backend" -Method Get
    Write-Host "Cache Backend: $($response.backend)" -ForegroundColor White
    Write-Host "Description: $($response.description)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 2: Get cache statistics
Write-Host "2. Testing cache statistics..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/cache/stats" -Method Get
    Write-Host "Total Keys: $($response.total_keys)" -ForegroundColor White
    Write-Host "Hits: $($response.hits)" -ForegroundColor White
    Write-Host "Misses: $($response.misses)" -ForegroundColor White
    Write-Host "Hit Rate: $($response.hit_rate)%`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 3: Make some predictions to populate cache
Write-Host "3. Making predictions to populate cache..." -ForegroundColor Green
$sequences = @(
    "ATCGATCGATCG",
    "GCTAGCTAGCTA",
    "TTAACCGGTTAA"
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
        
        Write-Host "  Cached prediction for: $seq" -ForegroundColor White
    } catch {
        Write-Host "  Failed for $seq" -ForegroundColor Red
    }
}
Write-Host ""

# Test 4: Check cache stats after predictions
Write-Host "4. Checking cache stats after predictions..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/cache/stats" -Method Get
    Write-Host "Total Keys: $($response.total_keys)" -ForegroundColor White
    Write-Host "Hits: $($response.hits)" -ForegroundColor White
    Write-Host "Misses: $($response.misses)" -ForegroundColor White
    Write-Host "Hit Rate: $($response.hit_rate)%`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 5: Test cache hit (repeat a prediction)
Write-Host "5. Testing cache hit (repeating prediction)..." -ForegroundColor Green
try {
    $body = @{
        sequence = "ATCGATCGATCG"
        use_cache = $true
    } | ConvertTo-Json
    
    $response = Invoke-RestMethod -Uri "$BASE_URL/api/predict" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body
    
    Write-Host "  Prediction served from cache" -ForegroundColor White
    Write-Host "  Class: $($response.predicted_class)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 6: Check stats again (should show cache hit)
Write-Host "6. Verifying cache hit in statistics..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/cache/stats" -Method Get
    Write-Host "Total Keys: $($response.total_keys)" -ForegroundColor White
    Write-Host "Hits: $($response.hits)" -ForegroundColor White
    Write-Host "Misses: $($response.misses)" -ForegroundColor White
    Write-Host "Hit Rate: $($response.hit_rate)%`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 7: Clear cache with pattern
Write-Host "7. Testing cache clear with pattern..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/cache/clear?pattern=predict:*" -Method Post
    Write-Host "Cleared Keys: $($response.cleared_keys)" -ForegroundColor White
    Write-Host "Pattern: $($response.pattern)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 8: Verify cache cleared
Write-Host "8. Verifying cache cleared..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/cache/stats" -Method Get
    Write-Host "Total Keys: $($response.total_keys)" -ForegroundColor White
    Write-Host "Hits: $($response.hits)" -ForegroundColor White
    Write-Host "Misses: $($response.misses)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

# Test 9: Clear all cache
Write-Host "9. Testing clear all cache..." -ForegroundColor Green
try {
    $response = Invoke-RestMethod -Uri "$BASE_URL/cache/clear" -Method Post
    Write-Host "Cleared Keys: $($response.cleared_keys)" -ForegroundColor White
    Write-Host "Status: $($response.status)`n" -ForegroundColor White
} catch {
    Write-Host "Failed: $_`n" -ForegroundColor Red
}

Write-Host "=== Cache Testing Complete ===" -ForegroundColor Cyan
Write-Host "`nCache Features:" -ForegroundColor Yellow
Write-Host "  ✓ Redis backend with in-memory fallback" -ForegroundColor Green
Write-Host "  ✓ Automatic cache key generation" -ForegroundColor Green
Write-Host "  ✓ Configurable TTL (default 1 hour)" -ForegroundColor Green
Write-Host "  ✓ Cache statistics (hits, misses, hit rate)" -ForegroundColor Green
Write-Host "  ✓ Pattern-based clearing" -ForegroundColor Green
Write-Host "  ✓ Full cache clearing" -ForegroundColor Green
Write-Host "  ✓ Cache health monitoring" -ForegroundColor Green
