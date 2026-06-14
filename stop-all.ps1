Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DEEPKYC SYSTEM TERMINATOR (STOP ALL SERVICES)   " -ForegroundColor Red -BackgroundColor Black
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "Scanning for services running on platform ports..." -ForegroundColor Gray
Write-Host ""

# Ports utilized by the DeepKYC platform
$Ports = @(
    @{ Port = 5000; Name = "Express Backend" },
    @{ Port = 5173; Name = "React Frontend (Vite)" },
    @{ Port = 8000; Name = "OCR Microservice" },
    @{ Port = 8001; Name = "Doc Preprocessing" },
    @{ Port = 5001; Name = "Bot Detection Service" },
    @{ Port = 8080; Name = "Biometric Liveness Service" }
)

$KilledCount = 0

foreach ($Service in $Ports) {
    $Port = $Service.Port
    $Name = $Service.Name
    
    # Get connections listening on the port
    $Connections = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    
    if ($Connections) {
        # Extract unique process IDs
        $Pids = $Connections.OwningProcess | Select-Object -Unique
        
        foreach ($ProcId in $Pids) {
            if ($ProcId -gt 0) {
                # Get the process details
                $Process = Get-Process -Id $ProcId -ErrorAction SilentlyContinue
                $ProcName = if ($Process) { $Process.ProcessName } else { "Unknown" }
                
                Write-Host "Found $Name listening on port $Port (Process: $ProcName, PID: $ProcId)" -ForegroundColor Yellow
                Write-Host "Stopping process $ProcId..." -ForegroundColor Gray
                
                Stop-Process -Id $ProcId -Force -ErrorAction SilentlyContinue
                $KilledCount++
            }
        }
    } else {
        Write-Host "Port $Port ($Name) is already free." -ForegroundColor Gray
    }
}

Write-Host ""
if ($KilledCount -gt 0) {
    Write-Host "==========================================================" -ForegroundColor Green
    Write-Host "   Successfully terminated $KilledCount running service(s)!" -ForegroundColor Green
    Write-Host "==========================================================" -ForegroundColor Green
} else {
    Write-Host "==========================================================" -ForegroundColor Cyan
    Write-Host "   No active DeepKYC services were found running." -ForegroundColor Cyan
    Write-Host "==========================================================" -ForegroundColor Cyan
}
