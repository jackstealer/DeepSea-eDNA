# Test MLOps Installation
# Run this to verify everything is setup correctly

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing MLOps Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# Test 1: Check Python
Write-Host "[1/7] Checking Python..." -NoNewline
try {
    $pythonVersion = python --version 2>&1
    if ($pythonVersion -match "Python 3\.(\d+)") {
        $minor = [int]$matches[1]
        if ($minor -ge 11) {
            Write-Host " ✅ $pythonVersion" -ForegroundColor Green
        } else {
            Write-Host " ⚠️  $pythonVersion (3.11+ recommended)" -ForegroundColor Yellow
        }
    }
} catch {
    Write-Host " ❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# Test 2: Check pip packages
Write-Host "[2/7] Checking required packages..." -NoNewline
$requiredPackages = @("fastapi", "uvicorn", "mlflow", "torch")
$missingPackages = @()
foreach ($pkg in $requiredPackages) {
    $installed = pip show $pkg 2>&1
    if ($LASTEXITCODE -ne 0) {
        $missingPackages += $pkg
    }
}
if ($missingPackages.Count -eq 0) {
    Write-Host " ✅ All packages installed" -ForegroundColor Green
} else {
    Write-Host " ❌ Missing: $($missingPackages -join ', ')" -ForegroundColor Red
    Write-Host "   Install with: pip install -r requirements.txt" -ForegroundColor Yellow
    $allGood = $false
}

# Test 3: Check model file
Write-Host "[3/7] Checking model file..." -NoNewline
if (Test-Path "models\best_model.pth") {
    $size = (Get-Item "models\best_model.pth").Length / 1MB
    Write-Host " ✅ Found ($([math]::Round($size, 2)) MB)" -ForegroundColor Green
} else {
    Write-Host " ❌ Not found" -ForegroundColor Red
    Write-Host "   Model will be available after training completes" -ForegroundColor Yellow
    $allGood = $false
}

# Test 4: Check Docker
Write-Host "[4/7] Checking Docker..." -NoNewline
try {
    $dockerVersion = docker --version 2>&1
    if ($LASTEXITCODE -eq 0) {
        Write-Host " ✅ $dockerVersion" -ForegroundColor Green
    } else {
        Write-Host " ⚠️  Not found (optional)" -ForegroundColor Yellow
    }
} catch {
    Write-Host " ⚠️  Not installed (optional)" -ForegroundColor Yellow
}

# Test 5: Check main.py
Write-Host "[5/7] Checking main.py..." -NoNewline
if (Test-Path "main.py") {
    Write-Host " ✅ Found" -ForegroundColor Green
} else {
    Write-Host " ❌ Missing" -ForegroundColor Red
    $allGood = $false
}

# Test 6: Check train_with_mlflow.py
Write-Host "[6/7] Checking train_with_mlflow.py..." -NoNewline
if (Test-Path "train_with_mlflow.py") {
    Write-Host " ✅ Found" -ForegroundColor Green
} else {
    Write-Host " ❌ Missing" -ForegroundColor Red
    $allGood = $false
}

# Test 7: Check CUDA availability
Write-Host "[7/7] Checking CUDA..." -NoNewline
$cudaCheck = python -c "import torch; print(torch.cuda.is_available())" 2>&1
if ($cudaCheck -match "True") {
    $deviceName = python -c "import torch; print(torch.cuda.get_device_name(0))" 2>&1
    Write-Host " ✅ Available ($deviceName)" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Not available (CPU mode)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
if ($allGood) {
    Write-Host "✅ Installation Complete!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Next steps:" -ForegroundColor Yellow
    Write-Host "1. Start MLflow: .\start_mlflow.ps1" -ForegroundColor Cyan
    Write-Host "2. Run API: .\run_api.ps1" -ForegroundColor Cyan
    Write-Host "3. Test API: Open http://localhost:8000/docs" -ForegroundColor Cyan
} else {
    Write-Host "⚠️  Some issues found" -ForegroundColor Yellow
    Write-Host "========================================" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Please fix the issues above and try again" -ForegroundColor Yellow
}
Write-Host ""
