# Test Authentication Features

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Authentication & API Keys" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8000"

# Test 1: Create API Key
Write-Host "1. Creating API Key..." -ForegroundColor Yellow

$keyData = @{
    name = "Test API Key"
    user_email = "test@example.com"
    organization = "DeepSea Research Lab"
    rate_limit = 1000
    expires_days = 365
} | ConvertTo-Json

try {
    $keyResponse = Invoke-RestMethod -Uri "$baseUrl/auth/keys" -Method Post `
        -Body $keyData -ContentType "application/json"
    
    Write-Host "  ✓ API Key created successfully!" -ForegroundColor Green
    Write-Host "  Key ID: $($keyResponse.key_id)" -ForegroundColor Cyan
    Write-Host "  Name: $($keyResponse.name)" -ForegroundColor White
    Write-Host "  User: $($keyResponse.user_email)" -ForegroundColor White
    Write-Host "  Rate Limit: $($keyResponse.rate_limit) requests/hour" -ForegroundColor White
    Write-Host "  Expires: $($keyResponse.expires_at)" -ForegroundColor White
    Write-Host ""
    Write-Host "  🔑 API Key: $($keyResponse.api_key)" -ForegroundColor Yellow
    Write-Host "  ⚠️  Save this key! It won't be shown again." -ForegroundColor Red
    
    $apiKey = $keyResponse.api_key
    
} catch {
    Write-Host "  ❌ Failed to create API key: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: List API Keys
Write-Host "2. Listing all API Keys..." -ForegroundColor Yellow

try {
    $keysList = Invoke-RestMethod -Uri "$baseUrl/auth/keys"
    
    Write-Host "  Total keys: $($keysList.total)" -ForegroundColor Green
    
    foreach ($key in $keysList.keys | Select-Object -First 5) {
        $status = if ($key.is_active) { "Active" } else { "Revoked" }
        Write-Host "    - [$status] $($key.name) ($($key.user_email))" -ForegroundColor White
        Write-Host "      Requests: $($key.total_requests)/$($key.rate_limit)" -ForegroundColor Cyan
    }
    
} catch {
    Write-Host "  ❌ Failed to list keys: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 3: Test unauthenticated request (should still work)
Write-Host "3. Testing without API key (backwards compatible)..." -ForegroundColor Yellow

$sequence = @{ sequence = "ATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCGATCG" } | ConvertTo-Json

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/predict" -Method Post `
        -Body $sequence -ContentType "application/json"
    
    Write-Host "  ✓ Prediction worked without API key" -ForegroundColor Green
    Write-Host "  Species: $($result.class_name)" -ForegroundColor White
    Write-Host "  Confidence: $($result.confidence.ToString('P2'))" -ForegroundColor White
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 4: Test authenticated request
Write-Host "4. Testing WITH API key..." -ForegroundColor Yellow

try {
    $headers = @{
        "X-API-Key" = $apiKey
    }
    
    $result = Invoke-RestMethod -Uri "$baseUrl/v2/predict" -Method Post `
        -Body $sequence -ContentType "application/json" -Headers $headers
    
    Write-Host "  ✓ Authenticated prediction successful!" -ForegroundColor Green
    Write-Host "  Species: $($result.class_name)" -ForegroundColor White
    Write-Host "  Confidence: $($result.confidence.ToString('P2'))" -ForegroundColor White
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 5: Get current key info
Write-Host "5. Getting current key information..." -ForegroundColor Yellow

try {
    $headers = @{
        "X-API-Key" = $apiKey
    }
    
    $keyInfo = Invoke-RestMethod -Uri "$baseUrl/auth/me" -Headers $headers
    
    Write-Host "  Key Name: $($keyInfo.name)" -ForegroundColor Green
    Write-Host "  User: $($keyInfo.user_email)" -ForegroundColor White
    Write-Host "  Organization: $($keyInfo.organization)" -ForegroundColor White
    Write-Host "  Total Requests: $($keyInfo.total_requests)" -ForegroundColor Cyan
    Write-Host "  Rate Limit: $($keyInfo.rate_limit)" -ForegroundColor White
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 6: Check usage stats
Write-Host "6. Checking API usage..." -ForegroundColor Yellow

try {
    $headers = @{
        "X-API-Key" = $apiKey
    }
    
    $usage = Invoke-RestMethod -Uri "$baseUrl/auth/usage" -Headers $headers
    
    Write-Host "  Usage: $($usage.total_requests)/$($usage.rate_limit) ($($usage.usage_percentage)%)" -ForegroundColor Cyan
    Write-Host "  Status: $($usage.status)" -ForegroundColor $(if ($usage.status -eq "normal") { "Green" } else { "Yellow" })
    Write-Host "  Remaining: $($usage.requests_remaining) requests" -ForegroundColor White
    
} catch {
    Write-Host "  ❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 7: Test invalid API key
Write-Host "7. Testing with invalid API key..." -ForegroundColor Yellow

try {
    $headers = @{
        "X-API-Key" = "invalid_key_12345"
    }
    
    $result = Invoke-RestMethod -Uri "$baseUrl/v2/predict" -Method Post `
        -Body $sequence -ContentType "application/json" -Headers $headers
    
    Write-Host "  ❌ Should have failed but didn't!" -ForegroundColor Red
    
} catch {
    Write-Host "  ✓ Correctly rejected invalid key" -ForegroundColor Green
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Test 8: Test request without key on authenticated endpoint
Write-Host "8. Testing authenticated endpoint without key..." -ForegroundColor Yellow

try {
    $result = Invoke-RestMethod -Uri "$baseUrl/v2/predict" -Method Post `
        -Body $sequence -ContentType "application/json"
    
    Write-Host "  ❌ Should have failed but didn't!" -ForegroundColor Red
    
} catch {
    Write-Host "  ✓ Correctly required API key" -ForegroundColor Green
    Write-Host "  Error: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""

# Test 9: Revoke API key (optional - comment out if you want to keep testing)
# Write-Host "9. Revoking API key..." -ForegroundColor Yellow
# try {
#     $revokeResponse = Invoke-RestMethod -Uri "$baseUrl/auth/keys/$($keyResponse.key_id)" -Method Delete
#     Write-Host "  ✓ API key revoked successfully" -ForegroundColor Green
# } catch {
#     Write-Host "  ❌ Failed to revoke: $($_.Exception.Message)" -ForegroundColor Red
# }

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ Authentication Testing Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Your API Key (save it!): $apiKey" -ForegroundColor Yellow
Write-Host ""
Write-Host "Usage Examples:" -ForegroundColor Cyan
Write-Host '  curl -H "X-API-Key: $apiKey" http://localhost:8000/v2/predict ...' -ForegroundColor White
Write-Host '  curl -H "X-API-Key: $apiKey" http://localhost:8000/auth/me' -ForegroundColor White
Write-Host '  curl -H "X-API-Key: $apiKey" http://localhost:8000/auth/usage' -ForegroundColor White
