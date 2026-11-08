# Test All MLOps Features
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host " Testing All MLOps Features" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

$baseUrl = "http://localhost:8000"

# Function to test endpoint
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Url,
        [string]$Method = "GET"
    )
    
    Write-Host "`n[$Name]" -ForegroundColor Yellow
    try {
        $response = Invoke-WebRequest -Uri "$baseUrl$Url" -Method $Method -UseBasicParsing
        Write-Host "✅ Status: $($response.StatusCode)" -ForegroundColor Green
        $content = $response.Content | ConvertFrom-Json | ConvertTo-Json -Depth 3
        Write-Host $content
        return $true
    } catch {
        Write-Host "❌ Failed: $($_.Exception.Message)" -ForegroundColor Red
        return $false
    }
}

# Test endpoints
Write-Host "`n=== Core Features ===" -ForegroundColor Cyan
Test-Endpoint "Health Check" "/health"
Test-Endpoint "Available Models" "/api/models"

Write-Host "`n=== Feature #5: Redis Caching ===" -ForegroundColor Cyan
Test-Endpoint "Cache Stats" "/cache/stats"
Test-Endpoint "Cache Backend" "/cache/backend"

Write-Host "`n=== Feature #6: Monitoring ===" -ForegroundColor Cyan
Test-Endpoint "System Metrics" "/monitoring/system"
Test-Endpoint "Application Metrics" "/monitoring/application"
Test-Endpoint "Dashboard Data" "/monitoring/dashboard"

Write-Host "`n=== Feature #7: Model Versioning ===" -ForegroundColor Cyan
Test-Endpoint "Model Versions List" "/versions"
Test-Endpoint "Current Version" "/versions/current/info"

Write-Host "`n=== Feature #8: A/B Testing ===" -ForegroundColor Cyan
Test-Endpoint "Active Experiments" "/experiments"
Test-Endpoint "Get Active Experiment" "/experiments/active"

Write-Host "`n=====================================" -ForegroundColor Cyan
Write-Host " Test Summary Complete!" -ForegroundColor Green
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "`nServer is running at: $baseUrl" -ForegroundColor Yellow
Write-Host "API Docs available at: $baseUrl/docs" -ForegroundColor Yellow
