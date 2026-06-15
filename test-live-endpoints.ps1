$endpoints = @{
    "Node Backend" = "https://synthetic-identity-fraud-detection-in-nzky.onrender.com/"
    "OCR Service" = "https://synthetic-identity-fraud-detection-in.onrender.com/"
    "Doc Preprocessing" = "https://synthetic-identity-fraud-detection-in-uk7i.onrender.com/"
    "Bot Detection" = "https://synthetic-identity-fraud-detection-in-5owb.onrender.com/health"
    "Biometric Service" = "https://synthetic-identity-fraud-detection-in-jz3s.onrender.com/"
}

foreach ($key in $endpoints.Keys) {
    $url = $endpoints[$key]
    Write-Host "----------------------------------------"
    Write-Host "Testing $key ($url)..."
    try {
        $response = Invoke-RestMethod -Uri $url -Method Get -TimeoutSec 120
        Write-Host "SUCCESS: " -ForegroundColor Green
        $response | ConvertTo-Json -Depth 3 | Write-Host
    } catch {
        Write-Host "ERROR: $($_.Exception.Message)" -ForegroundColor Red
    }
}
Write-Host "----------------------------------------"
