# Database Configuration
$masterDbHost = "localhost"
$masterDbPort = "5433"
$masterDbUser = "speedlimit"
$masterDbName = "speedlimit"
$env:PGPASSWORD = "speedlimit123"

Write-Host "------------------------------------------" -ForegroundColor Cyan
Write-Host "  PostgreSQL Table Export Utility (Windows)" -ForegroundColor Cyan
Write-Host "------------------------------------------" -ForegroundColor Cyan

# Fetch active tenants
Write-Host "Fetching active tenants...`n" -ForegroundColor Yellow

$env:PAGER = ""
$queryFile = [System.IO.Path]::GetTempFileName() + ".sql"
Set-Content -Path $queryFile -Value "SELECT `"dbName`" FROM `"Company`" WHERE status = 'active';"
# Run psql and get tuple-only output to make parsing easier
$psqlOutput = & psql -h $masterDbHost -p $masterDbPort -U $masterDbUser -d $masterDbName -t -f $queryFile
Remove-Item -Path $queryFile -ErrorAction SilentlyContinue

# Parse the output into an array of db names
$tenants = @()
foreach ($line in $psqlOutput) {
  if ($line -ne $null) {
    if (-not [string]::IsNullOrWhiteSpace($line)) {
      $trimmed = $line.Trim()
      if (-not [string]::IsNullOrEmpty($trimmed)) {
        $tenants += $trimmed
      }
    }
  }
}

if ($tenants.Count -eq 0) {
  Write-Host "No active tenants found." -ForegroundColor Red
  $env:PGPASSWORD = $null
  exit
}

Write-Host "Available Tenants:" -ForegroundColor Cyan
for ($i = 0; $i -lt $tenants.Count; $i++) {
  Write-Host "  [$($i + 1)] $($tenants[$i])"
}
Write-Host "  [0] ALL Tenants"

$selection = Read-Host "`nEnter your selection (0-$($tenants.Count)) (default: 0)"

if ([string]::IsNullOrWhiteSpace($selection)) {
  $selection = "0"
}

$selectedTenants = @()
if ($selection -eq "0") {
  $selectedTenants = $tenants
}
else {
  try {
    $index = [int]$selection - 1
    if ($index -ge 0 -and $index -lt $tenants.Count) {
      $selectedTenants += $tenants[$index]
    }
    else {
      Write-Host "Invalid selection." -ForegroundColor Red
      $env:PGPASSWORD = $null
      exit
    }
  }
  catch {
    Write-Host "Invalid input. Please enter a number." -ForegroundColor Red
    $env:PGPASSWORD = $null
    exit
  }
}

# Ask for the table name
$tableName = Read-Host "`nEnter the Table Name to export (Case-Sensitive)"
if ([string]::IsNullOrWhiteSpace($tableName)) {
  Write-Host "Table Name cannot be empty." -ForegroundColor Red
  $env:PGPASSWORD = $null
  exit
}

Write-Host "`nStarting export...`n" -ForegroundColor Yellow

# Ensure backup directory exists
$backupDir = "backup"
if (!(Test-Path -Path $backupDir)) {
  New-Item -ItemType Directory -Path $backupDir | Out-Null
}

$successCount = 0
$failCount = 0

foreach ($tenantDb in $selectedTenants) {
  $outputFile = Join-Path -Path $backupDir -ChildPath "${tenantDb}_${tableName}_seed.sql"
  Write-Host "Exporting table '$tableName' from database '$tenantDb' to $outputFile..." -ForegroundColor Cyan

  # Execute pg_dump
  # Note: Ensure pg_dump is in your System PATH
  & pg_dump -h $masterDbHost -p $masterDbPort -U $masterDbUser -d $tenantDb `
    --table="`"$tableName`"" `
    --data-only `
    --column-inserts `
    -f $outputFile

  if ($LASTEXITCODE -eq 0) {
    Write-Host "  Successfully exported $tenantDb" -ForegroundColor Green
    $successCount++
  }
  else {
    Write-Host "  Error: Export failed for $tenantDb. Is pg_dump installed and in your PATH? Does the database/table exist?" -ForegroundColor Red
    $failCount++
  }
}

Write-Host "`n------------------------------------------" -ForegroundColor Cyan
Write-Host "Export Summary:" -ForegroundColor Cyan
Write-Host "  Success: $successCount" -ForegroundColor Green
Write-Host "  Failed:  $failCount" -ForegroundColor Red
Write-Host "------------------------------------------" -ForegroundColor Cyan

# Clear password
$env:PGPASSWORD = $null