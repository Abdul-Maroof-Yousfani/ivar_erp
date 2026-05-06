# Test Sandwich Rule API - PowerShell Version
# This script will apply sandwich rules to all Friday-Monday absent pairs

Write-Host "🔧 Testing Sandwich Rule API..." -ForegroundColor Cyan
Write-Host ""

# Get your auth token first
# Replace YOUR_TOKEN with actual token from login
$TOKEN = "YOUR_TOKEN_HERE"

# Apply sandwich rules for all dates
Write-Host "📅 Applying sandwich rules for all dates..." -ForegroundColor Yellow

$headers = @{
    "Authorization" = "Bearer $TOKEN"
    "Content-Type" = "application/json"
}

$body = @{} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "http://localhost:3000/api/attendances/apply-sandwich-rules" `
        -Method Post `
        -Headers $headers `
        -Body $body

    Write-Host "✅ Success!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Results:" -ForegroundColor Cyan
    $response | ConvertTo-Json -Depth 10 | Write-Host
    
    Write-Host ""
    Write-Host "Applied Count: $($response.data.appliedCount)" -ForegroundColor Green
    Write-Host "Skipped Count: $($response.data.skippedCount)" -ForegroundColor Yellow
    Write-Host "Total Processed: $($response.data.totalProcessed)" -ForegroundColor Cyan
} catch {
    Write-Host "❌ Error: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "✅ Done! Check attendance records now." -ForegroundColor Green
