# PowerShell script to start both frontend and backend for development
# This runs locally (not in Docker)

Write-Host "=== Speed Limit Development Startup ===" -ForegroundColor Cyan
Write-Host ""

# Check if .env files exist
$backendEnv = "nestjs_backend\.env"
$frontendEnv = "frontend\.env"

if (-not (Test-Path $backendEnv)) {
    Write-Host "[WARNING] Backend .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating backend .env from template..." -ForegroundColor Yellow
    
    $backendEnvContent = @"
DATABASE_URL=postgresql://speedlimit:speedlimit123@localhost:5432/speedlimit
PORT=3000
FRONTEND_URL=http://localhost:3001
JWT_ACCESS_SECRET=your-super-secret-access-key-change-in-production
JWT_REFRESH_SECRET=your-super-secret-refresh-key-change-in-production
NODE_ENV=development
"@
    Set-Content -Path $backendEnv -Value $backendEnvContent
    Write-Host "[OK] Backend .env created!" -ForegroundColor Green
}

if (-not (Test-Path $frontendEnv)) {
    Write-Host "[WARNING] Frontend .env file not found!" -ForegroundColor Yellow
    Write-Host "Creating frontend .env from template..." -ForegroundColor Yellow
    
    $frontendEnvContent = @"
NEXT_PUBLIC_API_BASE_URL=http://localhost:3000/api
API_URL=http://localhost:3000/api
NODE_ENV=development
"@
    Set-Content -Path $frontendEnv -Value $frontendEnvContent
    Write-Host "[OK] Frontend .env created!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Checking Prerequisites ===" -ForegroundColor Cyan

# Check if Bun is installed
$bunCheck = Get-Command bun -ErrorAction SilentlyContinue
if (-not $bunCheck) {
    Write-Host "[ERROR] Bun is not installed!" -ForegroundColor Red
    Write-Host "Please install Bun from: https://bun.sh" -ForegroundColor Yellow
    exit 1
}
Write-Host "[OK] Bun is installed" -ForegroundColor Green

# Check if Postgres is accessible (if Docker is running)
Write-Host "Checking database connection..." -ForegroundColor Yellow
$dbCheck = docker ps --filter "name=speed-limit-postgres" --format "{{.Names}}" 2>&1
if ($dbCheck -like "*speed-limit-postgres*") {
    Write-Host "[OK] Postgres container is running" -ForegroundColor Green
} else {
    Write-Host "[WARNING] Postgres container not found. Make sure Docker is running and containers are up." -ForegroundColor Yellow
    Write-Host "Run: docker-compose up -d postgres" -ForegroundColor White
}

Write-Host ""
Write-Host "=== Installing Dependencies ===" -ForegroundColor Cyan

# Install backend dependencies
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
Push-Location nestjs_backend
if (Test-Path "node_modules") {
    Write-Host "Backend dependencies already installed, skipping..." -ForegroundColor Gray
} else {
    bun install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install backend dependencies" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}
Pop-Location

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
if (Test-Path "node_modules") {
    Write-Host "Frontend dependencies already installed, skipping..." -ForegroundColor Gray
} else {
    bun install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "[ERROR] Failed to install frontend dependencies" -ForegroundColor Red
        Pop-Location
        exit 1
    }
}
Pop-Location

Write-Host ""
Write-Host "=== Setting up Database ===" -ForegroundColor Cyan
Push-Location nestjs_backend
Write-Host "Generating Prisma client..." -ForegroundColor Yellow
bun run prisma:generate
if ($LASTEXITCODE -ne 0) {
    Write-Host "[WARNING] Prisma generate failed, continuing anyway..." -ForegroundColor Yellow
}
Pop-Location

Write-Host ""
Write-Host "=== Starting Development Servers ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "Backend will run on: http://localhost:3000" -ForegroundColor Green
Write-Host "Frontend will run on: http://localhost:3001" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C to stop both servers" -ForegroundColor Yellow
Write-Host ""

# Start backend in a new window
Write-Host "Starting backend..." -ForegroundColor Yellow
$backendScript = @"
cd `"$PWD\nestjs_backend`"
`$env:DATABASE_URL = 'postgresql://speedlimit:speedlimit123@localhost:5432/speedlimit'
`$env:PORT = '3000'
`$env:FRONTEND_URL = 'http://localhost:3001'
`$env:NODE_ENV = 'development'
bun run start:dev
"@

# Start frontend in a new window
Write-Host "Starting frontend..." -ForegroundColor Yellow
$frontendScript = @"
cd `"$PWD\frontend`"
`$env:NEXT_PUBLIC_API_BASE_URL = 'http://localhost:3000/api'
`$env:API_URL = 'http://localhost:3000/api'
`$env:NODE_ENV = 'development'
bun run dev
"@

# Create temporary script files
$backendScriptFile = "$env:TEMP\speed-limit-backend.ps1"
$frontendScriptFile = "$env:TEMP\speed-limit-frontend.ps1"

Set-Content -Path $backendScriptFile -Value $backendScript
Set-Content -Path $frontendScriptFile -Value $frontendScript

# Start both in new PowerShell windows
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$backendScriptFile'"
Start-Sleep -Seconds 2
Start-Process powershell -ArgumentList "-NoExit", "-Command", "& '$frontendScriptFile'"

Write-Host ""
Write-Host "[OK] Both servers are starting in separate windows!" -ForegroundColor Green
Write-Host ""
Write-Host "Backend: http://localhost:3000" -ForegroundColor Cyan
Write-Host "Frontend: http://localhost:3001" -ForegroundColor Cyan
Write-Host ""
Write-Host "Close the PowerShell windows to stop the servers." -ForegroundColor Yellow

