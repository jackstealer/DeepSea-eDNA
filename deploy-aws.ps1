# AWS Deployment Script for DeepSea eDNA AI
# Automated deployment to AWS
# Region: ap-southeast-2 (Sydney)

param(
    [Parameter(Mandatory=$false)]
    [string]$Stage = "full"
)

$Region = "ap-southeast-2"
$AccountId = "755234501944"
$AppName = "deepsea-edna-app"

Write-Host "`n=== DeepSea eDNA AI - AWS Deployment ===" -ForegroundColor Cyan
Write-Host "Region: $Region | Stage: $Stage" -ForegroundColor Gray

# Refresh PATH
$env:Path = [System.Environment]::GetEnvironmentVariable("Path","Machine") + ";" + [System.Environment]::GetEnvironmentVariable("Path","User")

# Check AWS credentials
try {
    $Identity = aws sts get-caller-identity --output json | ConvertFrom-Json
    Write-Host "[OK] AWS Authenticated as Account: $($Identity.Account)" -ForegroundColor Green
} catch {
    Write-Host "[X] AWS credentials not configured. Run: aws login" -ForegroundColor Red
    exit 1
}

if ($Stage -eq "full" -or $Stage -eq "ecr") {
    Write-Host "`nStep 1: Setting up ECR Repository..." -ForegroundColor Yellow
    
    # Create ECR repository
    $EcrCheck = aws ecr describe-repositories --repository-names $AppName --region $Region 2>&1
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Creating ECR repository..." -ForegroundColor Gray
        aws ecr create-repository --repository-name $AppName --region $Region --image-scanning-configuration scanOnPush=true | Out-Null
        Write-Host "[OK] ECR repository created" -ForegroundColor Green
    } else {
        Write-Host "[OK] ECR repository already exists" -ForegroundColor Green
    }
    
    # Get ECR URI
    $EcrUri = aws ecr describe-repositories --repository-names $AppName --region $Region --query 'repositories[0].repositoryUri' --output text
    
    Write-Host "ECR URI: $EcrUri" -ForegroundColor Cyan
}

if ($Stage -eq "full" -or $Stage -eq "build") {
    Write-Host "`nStep 2: Building and Pushing Docker Image..." -ForegroundColor Yellow
    
    # Check if Docker is running
    try {
        docker info | Out-Null
        if ($LASTEXITCODE -ne 0) {
            Write-Host "[X] Docker is not running. Please start Docker Desktop." -ForegroundColor Red
            exit 1
        }
    } catch {
        Write-Host "❌ Docker is not running. Please start Docker Desktop." -ForegroundColor Red
        exit 1
    }
    
    # Login to ECR
    Write-Host "Logging into ECR..." -ForegroundColor Gray
    $LoginCmd = aws ecr get-login-password --region $Region
    $LoginCmd | docker login --username AWS --password-stdin "${AccountId}.dkr.ecr.${Region}.amazonaws.com"
    
    # Build image locally
    Write-Host "Building Docker image..." -ForegroundColor Gray
    docker build -t ${AppName}:latest .
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Docker build failed" -ForegroundColor Red
        exit 1
    }
    
    # Tag and push
    $EcrUri = "${AccountId}.dkr.ecr.${Region}.amazonaws.com/${AppName}"
    docker tag ${AppName}:latest ${EcrUri}:latest
    
    Write-Host "Pushing to ECR..." -ForegroundColor Gray
    docker push ${EcrUri}:latest
    
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[X] Docker push failed" -ForegroundColor Red
        exit 1
    }
    
    Write-Host "[OK] Image pushed successfully" -ForegroundColor Green
    Write-Host "Image URI: ${EcrUri}:latest" -ForegroundColor Cyan
}

Write-Host "`nDeployment script completed!" -ForegroundColor Cyan
Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Your Docker image is now in ECR: ${AccountId}.dkr.ecr.${Region}.amazonaws.com/${AppName}:latest" -ForegroundColor White
Write-Host "2. Deploy using AWS Console or CLI with ECS, App Runner, or Lambda" -ForegroundColor White
Write-Host "3. Or run locally: docker run -p 8000:8000 ${AppName}:latest" -ForegroundColor White
