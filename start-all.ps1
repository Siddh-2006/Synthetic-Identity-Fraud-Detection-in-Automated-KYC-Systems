# Get the root directory of the project
$RootPath = $PSScriptRoot

# Set window title and banner
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "   DEEPKYC SYSTEM INITIALIZER (ALL SERVICES)   " -ForegroundColor Green -BackgroundColor Black
Write-Host "==========================================================" -ForegroundColor Cyan
Write-Host "This script will launch the 6 core AI/Web services in separate windows." -ForegroundColor Gray
Write-Host "Make sure MongoDB is running and server/.env is configured." -ForegroundColor Yellow
Write-Host ""

# Check for .env file
$EnvFile = Join-Path $RootPath "server\.env"
if (-not (Test-Path $EnvFile)) {
    Write-Host "[WARNING] server/.env not found! Some features (DB/Cloudinary) may fail." -ForegroundColor Yellow
    Write-Host "Please create a .env file under server/ directory before using." -ForegroundColor Gray
    Write-Host ""
}

# Define the services
$Services = @(
    @{
        Name = "1. Express Backend (Port 5000)"
        Path = Join-Path $RootPath "server"
        Command = "npm run dev"
        Color = "Green"
    },
    @{
        Name = "2. React Frontend (Port 5173)"
        Path = Join-Path $RootPath "client"
        Command = "npm run dev"
        Color = "Blue"
    },
    @{
        Name = "3. OCR Microservice (Port 8000)"
        Path = Join-Path $RootPath "services\ocr"
        Command = "python app/main.py"
        Color = "Cyan"
    },
    @{
        Name = "4. Doc Preprocessing Microservice (Port 8001)"
        Path = Join-Path $RootPath "services\doc_preprocessing"
        Command = "python app.py"
        Color = "Magenta"
    },
    @{
        Name = "5. Bot Detection Service (Port 5001)"
        Path = Join-Path $RootPath "services\bot-detection\backend"
        Command = "python app.py"
        Color = "Yellow"
    },
    @{
        Name = "6. Biometric Liveness Service (Port 8080)"
        Path = Join-Path $RootPath "services\biometric\python-microservice"
        Command = "python app.py"
        Color = "DarkCyan"
    }
)

# Launch each service in a new window
foreach ($Service in $Services) {
    Write-Host "Starting $($Service.Name)..." -ForegroundColor $Service.Color
    
    $Dir = $Service.Path
    $Cmd = $Service.Command
    
    # We use Start-Process with cmd.exe to launch a new command shell window
    Start-Process cmd.exe -ArgumentList "/k", "title $($Service.Name) && cd /d `"$Dir`" && $Cmd"
    
    # Sleep briefly to reduce CPU spikes and database connection races
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host "==========================================================" -ForegroundColor Green
Write-Host "   All services initiated! Check individual windows." -ForegroundColor Green
Write-Host "   Frontend is launching at http://localhost:5173" -ForegroundColor Green
Write-Host "==========================================================" -ForegroundColor Green
