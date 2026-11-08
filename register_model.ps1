# Register the trained marine model in the version registry

$BASE_URL = "http://localhost:8000"

Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "Registering Marine Model v1.0" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Prepare query parameters
$versionName = "marine_model_v1.0"
$modelPath = "C:\Users\ATUL\Desktop\DeepSea-eDNA-AI-main\ml_models\marine_model\marine_model.h5"
$description = "Initial production model trained on 8 marine taxa classes with 94.18% accuracy"

# Build URL with query parameters
$url = "$BASE_URL/versions/register"
$url += "?version_name=$([uri]::EscapeDataString($versionName))"
$url += "&model_path=$([uri]::EscapeDataString($modelPath))"
$url += "&description=$([uri]::EscapeDataString($description))"
$url += "&set_as_current=true"

Write-Host "Registration URL prepared..." -ForegroundColor Yellow
Write-Host ""

try {
    # Register the model
    $result = Invoke-RestMethod -Uri $url -Method Post
    
    Write-Host "SUCCESS! Model registered ✅" -ForegroundColor Green
    Write-Host ""
    Write-Host "  Version ID: $($result.version_id)" -ForegroundColor Gray
    Write-Host "  Version Name: $($result.version_name)" -ForegroundColor Gray
    Write-Host "  Is Current: $($result.is_current)" -ForegroundColor Gray
    Write-Host "  Status: $($result.status)" -ForegroundColor Gray
    Write-Host ""
    
    # Verify registration by getting current version
    Write-Host "Verifying registration..." -ForegroundColor Yellow
    $current = Invoke-RestMethod -Uri "$BASE_URL/versions/current/info" -Method Get
    
    Write-Host "  Current Version: $($current.version_name)" -ForegroundColor Green
    Write-Host "  Accuracy: $($current.metrics.accuracy * 100)%" -ForegroundColor Green
    Write-Host ""
    
    # Get version history
    Write-Host "Version history:" -ForegroundColor Yellow
    $history = Invoke-RestMethod -Uri "$BASE_URL/versions/history" -Method Get
    Write-Host "  Total versions registered: $($history.total)" -ForegroundColor Gray
    Write-Host ""
    
    # Get statistics
    Write-Host "Version registry statistics:" -ForegroundColor Yellow
    $stats = Invoke-RestMethod -Uri "$BASE_URL/versions/statistics" -Method Get
    Write-Host "  Total versions: $($stats.total_versions)" -ForegroundColor Gray
    Write-Host "  Active versions: $($stats.active_versions)" -ForegroundColor Gray
    Write-Host ""
    
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host "Model Registration Complete! ✅" -ForegroundColor Cyan
    Write-Host "========================================`n" -ForegroundColor Cyan
    
} catch {
    Write-Host "FAILED to register model ❌" -ForegroundColor Red
    Write-Host "Error: $_" -ForegroundColor Red
    Write-Host ""
}
