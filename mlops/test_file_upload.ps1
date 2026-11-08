# Test File Upload Features

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing File Upload & Batch Processing" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

$baseUrl = "http://localhost:8000"

# Test 1: Upload FASTA file
Write-Host "1. Uploading FASTA file..." -ForegroundColor Yellow
$fastaPath = ".\sample_data\test_sequences.fasta"

if (!(Test-Path $fastaPath)) {
    Write-Host "  ❌ Sample FASTA file not found at $fastaPath" -ForegroundColor Red
    exit 1
}

try {
    $fastaFile = Get-Item $fastaPath
    $boundary = [System.Guid]::NewGuid().ToString()
    $fileName = $fastaFile.Name
    
    # Read file content
    $fileContent = [System.IO.File]::ReadAllBytes($fastaFile.FullName)
    
    # Create multipart form data
    $bodyLines = @(
        "--$boundary",
        "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
        "Content-Type: text/plain",
        "",
        [System.Text.Encoding]::UTF8.GetString($fileContent),
        "--$boundary--"
    ) -join "`r`n"
    
    $response = Invoke-RestMethod -Uri "$baseUrl/upload/fasta" -Method Post `
        -ContentType "multipart/form-data; boundary=$boundary" `
        -Body $bodyLines
    
    Write-Host "  ✓ Upload successful!" -ForegroundColor Green
    Write-Host "  Job ID: $($response.job_id)" -ForegroundColor Cyan
    Write-Host "  Status: $($response.status)" -ForegroundColor Green
    Write-Host "  Total sequences: $($response.total_sequences)" -ForegroundColor White
    Write-Host "  Successful: $($response.successful)" -ForegroundColor Green
    Write-Host "  Failed: $($response.failed)" -ForegroundColor $(if ($response.failed -gt 0) { "Red" } else { "White" })
    
    $jobId = $response.job_id
    
    Write-Host ""
    Write-Host "  Results by species:" -ForegroundColor Cyan
    if ($response.summary.predictions_by_class) {
        foreach ($class in $response.summary.predictions_by_class.PSObject.Properties) {
            Write-Host "    $($class.Name): $($class.Value)" -ForegroundColor White
        }
    }
    
    Write-Host ""
    Write-Host "  Average confidence: $($response.summary.avg_confidence.ToString('P2'))" -ForegroundColor Yellow
    
} catch {
    Write-Host "  ❌ FASTA upload failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""

# Test 2: Upload CSV file
Write-Host "2. Uploading CSV file..." -ForegroundColor Yellow
$csvPath = ".\sample_data\test_sequences.csv"

if (!(Test-Path $csvPath)) {
    Write-Host "  ❌ Sample CSV file not found at $csvPath" -ForegroundColor Red
} else {
    try {
        $csvFile = Get-Item $csvPath
        $boundary = [System.Guid]::NewGuid().ToString()
        $fileName = $csvFile.Name
        
        $fileContent = [System.IO.File]::ReadAllBytes($csvFile.FullName)
        
        $bodyLines = @(
            "--$boundary",
            "Content-Disposition: form-data; name=`"file`"; filename=`"$fileName`"",
            "Content-Type: text/csv",
            "",
            [System.Text.Encoding]::UTF8.GetString($fileContent),
            "--$boundary--"
        ) -join "`r`n"
        
        $response = Invoke-RestMethod -Uri "$baseUrl/upload/csv" -Method Post `
            -ContentType "multipart/form-data; boundary=$boundary" `
            -Body $bodyLines
        
        Write-Host "  ✓ CSV upload successful!" -ForegroundColor Green
        Write-Host "  Job ID: $($response.job_id)" -ForegroundColor Cyan
        Write-Host "  Processed: $($response.processed)/$($response.total_sequences)" -ForegroundColor White
        
        $jobId = $response.job_id
        
    } catch {
        Write-Host "  ❌ CSV upload failed: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Test 3: Check batch job status
if ($jobId) {
    Write-Host "3. Checking job status..." -ForegroundColor Yellow
    try {
        $jobStatus = Invoke-RestMethod -Uri "$baseUrl/batch/$jobId"
        
        Write-Host "  Job ID: $($jobStatus.job_id)" -ForegroundColor Cyan
        Write-Host "  Status: $($jobStatus.status)" -ForegroundColor Green
        Write-Host "  Progress: $($jobStatus.progress_percentage)%" -ForegroundColor Yellow
        Write-Host "  Processed: $($jobStatus.processed_sequences)/$($jobStatus.total_sequences)" -ForegroundColor White
        Write-Host "  Created: $($jobStatus.created_at)" -ForegroundColor White
        
        if ($jobStatus.completed_at) {
            Write-Host "  Completed: $($jobStatus.completed_at)" -ForegroundColor Green
        }
        
    } catch {
        Write-Host "  ❌ Failed to get job status: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""

# Test 4: Download results
if ($jobId) {
    Write-Host "4. Downloading results..." -ForegroundColor Yellow
    try {
        $csvResults = Invoke-RestMethod -Uri "$baseUrl/batch/$jobId/download/csv"
        Write-Host "  ✓ Downloaded CSV results" -ForegroundColor Green
        Write-Host "  Preview:" -ForegroundColor Cyan
        Write-Host $csvResults.Substring(0, [Math]::Min(200, $csvResults.Length)) -ForegroundColor White
        
    } catch {
        Write-Host "  ❌ Failed to download results: $($_.Exception.Message)" -ForegroundColor Red
    }
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ File Upload Testing Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "New Endpoints Available:" -ForegroundColor Cyan
Write-Host "  POST /upload/fasta - Upload FASTA file" -ForegroundColor White
Write-Host "  POST /upload/csv - Upload CSV file" -ForegroundColor White
Write-Host "  GET /batch/{job_id} - Check job status" -ForegroundColor White
Write-Host "  GET /batch/{job_id}/download/csv - Download results" -ForegroundColor White
