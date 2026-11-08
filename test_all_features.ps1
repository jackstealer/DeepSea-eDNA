# Test All Features - DeepSea eDNA API
# Comprehensive test suite for all 15 features

$BASE_URL = "http://localhost:8000"
$ErrorActionPreference = "Continue"

Write-Host "`n╔══════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║  DeepSea eDNA API - Complete Feature Test Suite            ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════════════╝" -ForegroundColor Cyan

$totalTests = 0
$passedTests = 0
$failedTests = 0

function Test-Feature {
    param(
        [string]$Name,
        [string]$Endpoint,
        [string]$Method = "GET",
        [hashtable]$Headers = @{},
        [string]$Body = $null
    )
    
    $script:totalTests++
    Write-Host "`n[$script:totalTests] Testing: $Name" -ForegroundColor Yellow
    
    try {
        $params = @{
            Uri = "$BASE_URL$Endpoint"
            Method = $Method
            Headers = $Headers
        }
        
        if ($Body) {
            $params['Body'] = $Body
            $params['ContentType'] = "application/json"
        }
        
        $response = Invoke-RestMethod @params -ErrorAction Stop
        Write-Host "  ✓ PASS" -ForegroundColor Green
        $script:passedTests++
        return $response
    } catch {
        Write-Host "  ✗ FAIL: $($_.Exception.Message)" -ForegroundColor Red
        $script:failedTests++
        return $null
    }
}

# Wait for API to be ready
Write-Host "`nWaiting for API to be ready..." -ForegroundColor Yellow
$maxRetries = 10
$retry = 0
while ($retry -lt $maxRetries) {
    try {
        $response = Invoke-RestMethod -Uri "$BASE_URL/health" -ErrorAction Stop
        Write-Host "API is ready!" -ForegroundColor Green
        break
    } catch {
        $retry++
        Write-Host "  Attempt $retry/$maxRetries..." -ForegroundColor Gray
        Start-Sleep -Seconds 2
    }
}

if ($retry -eq $maxRetries) {
    Write-Host "`nERROR: API is not responding. Please start the server first." -ForegroundColor Red
    Write-Host "Run: .\start_local.ps1" -ForegroundColor Yellow
    exit 1
}

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Feature Testing Started" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Feature #1: Basic Health Check
Test-Feature "Basic Health Check" "/health"

# Feature #2: Detailed Health Check
Test-Feature "Detailed Health Check" "/health/detailed"

# Feature #9: Security Statistics
Test-Feature "Security Statistics" "/auth/security-stats"

# Feature #9: Login (Authentication)
$loginResponse = Test-Feature "User Login" "/auth/token" "POST" @{} @"
username=admin&password=admin123
"@

if ($loginResponse -and $loginResponse.access_token) {
    $token = $loginResponse.access_token
    $authHeaders = @{ "Authorization" = "Bearer $token" }
    
    # Feature #9: Get Current User
    Test-Feature "Get Current User" "/auth/me" "GET" $authHeaders
    
    # Feature #9: List Users
    Test-Feature "List Users" "/auth/users"
    
    # Feature #9: Permissions List
    Test-Feature "Permissions List" "/auth/permissions"
}

# Feature #6: System Monitoring
Test-Feature "System Metrics" "/monitoring/system"

# Feature #6: Application Metrics
Test-Feature "Application Metrics" "/monitoring/application"

# Feature #6: Dashboard Metrics
Test-Feature "Dashboard Metrics" "/monitoring/dashboard"

# Feature #5: Cache Statistics
Test-Feature "Cache Statistics" "/cache/stats"

# Feature #5: Cache Backend Info
Test-Feature "Cache Backend Info" "/cache/backend"

# Feature #7: List Versions
Test-Feature "List Model Versions" "/versions"

# Feature #7: Version Statistics
Test-Feature "Version Statistics" "/versions/statistics"

# Feature #7: Version History
Test-Feature "Version History" "/versions/history"

# Feature #8: List Experiments
Test-Feature "List A/B Experiments" "/experiments"

# Feature #8: Active Experiment
Test-Feature "Active Experiment" "/experiments/active"

# Feature #: Prometheus Metrics
Test-Feature "Prometheus Metrics" "/metrics"

Write-Host "`n═══════════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host " Test Results Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Total Tests:  $totalTests" -ForegroundColor White
Write-Host "Passed:       $passedTests " -ForegroundColor Green -NoNewline
Write-Host "($([math]::Round($passedTests/$totalTests*100, 1))%)" -ForegroundColor Green
Write-Host "Failed:       $failedTests " -ForegroundColor $(if($failedTests -eq 0){"Green"}else{"Red"}) -NoNewline
Write-Host "($([math]::Round($failedTests/$totalTests*100, 1))%)" -ForegroundColor $(if($failedTests -eq 0){"Green"}else{"Red"})

Write-Host "`n═══════════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

if ($failedTests -eq 0) {
    Write-Host "🎉 All tests passed! Platform is working correctly!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "⚠️  Some tests failed. Please check the errors above." -ForegroundColor Yellow
    exit 1
}
