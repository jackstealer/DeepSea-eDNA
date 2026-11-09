# AWS ECS Deployment Script for DeepSea eDNA AI
# Usage: .\deploy-aws.ps1 -Stage setup|deploy|update

param(
    [Parameter(Mandatory=$false)]
    [string]$Region = "us-east-1",
    [Parameter(Mandatory=$false)]
    [string]$Stage = "setup"
)

$ECR_REPO = "deepsea-edna"
$CLUSTER = "deepsea-cluster"
$SERVICE = "deepsea-service"

Write-Host "`n=== AWS Deployment - Stage: $Stage ===" -ForegroundColor Cyan

# Check AWS CLI
try {
    aws --version | Out-Null
    Write-Host "✅ AWS CLI found" -ForegroundColor Green
} catch {
    Write-Host "❌ AWS CLI not found. Install: https://aws.amazon.com/cli/" -ForegroundColor Red
    exit 1
}

if ($Stage -eq "setup") {
    Write-Host "`nCreating AWS resources..." -ForegroundColor Yellow
    
    # Create ECR
    aws ecr create-repository --repository-name $ECR_REPO --region $Region 2>$null
    Write-Host "✅ ECR repository created" -ForegroundColor Green
    
    # Create ECS cluster  
    aws ecs create-cluster --cluster-name $CLUSTER --region $Region | Out-Null
    Write-Host "✅ ECS cluster created" -ForegroundColor Green
    
    Write-Host "`n✅ Setup complete!" -ForegroundColor Green
    Write-Host "Next: Create RDS database, then run: .\deploy-aws.ps1 -Stage deploy" -ForegroundColor Cyan
}

if ($Stage -eq "deploy") {
    Write-Host "`nDeploying to AWS..." -ForegroundColor Yellow
    
    # Get ECR URI
    $ECR_URI = aws ecr describe-repositories --repository-names $ECR_REPO --region $Region --query 'repositories[0].repositoryUri' --output text
    
    # Login
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ECR_URI.Split('/')[0]
    
    # Push image
    docker pull ghcr.io/jackstealer/deepsea-edna:latest
    docker tag ghcr.io/jackstealer/deepsea-edna:latest ${ECR_URI}:latest
    docker push ${ECR_URI}:latest
    
    Write-Host "`n✅ Image pushed to ECR: $ECR_URI" -ForegroundColor Green
    Write-Host "Next: Update task-definition.json and create ECS service via AWS Console" -ForegroundColor Cyan
}

if ($Stage -eq "update") {
    Write-Host "`nUpdating deployment..." -ForegroundColor Yellow
    
    $ECR_URI = aws ecr describe-repositories --repository-names $ECR_REPO --region $Region --query 'repositories[0].repositoryUri' --output text
    
    aws ecr get-login-password --region $Region | docker login --username AWS --password-stdin $ECR_URI.Split('/')[0]
    docker pull ghcr.io/jackstealer/deepsea-edna:latest
    docker tag ghcr.io/jackstealer/deepsea-edna:latest ${ECR_URI}:latest
    docker push ${ECR_URI}:latest
    
    aws ecs update-service --cluster $CLUSTER --service $SERVICE --force-new-deployment --region $Region | Out-Null
    
    Write-Host "`n✅ Deployment updated!" -ForegroundColor Green
}
