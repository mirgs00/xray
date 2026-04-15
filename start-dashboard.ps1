# save as: start-dashboard.ps1
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "   XRAY TEST EXECUTION DASHBOARD LAUNCHER" -ForegroundColor Cyan
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $ScriptDir

# Check Node.js
try {
    $nodeVer = & node --version 2>$null
    Write-Host "[OK] Node.js found: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "[ERROR] Node.js not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}

# Check for proxy server
$ProxyFile = Join-Path $ScriptDir "xray-proxy-server.js"
if (-not (Test-Path $ProxyFile)) {
    Write-Host "[ERROR] xray-proxy-server.js not found" -ForegroundColor Red
    Read-Host "Press Enter to exit"
    exit 1
}
Write-Host "[OK] Proxy server file found" -ForegroundColor Green

# Find dashboard file
$DashboardFile = @("xray-test-dashboard.html", "dashboard.html", "index.html") | 
    Where-Object { Test-Path (Join-Path $ScriptDir $_) } | 
    Select-Object -First 1

if ($DashboardFile) {
    Write-Host "[OK] Found dashboard: $DashboardFile" -ForegroundColor Green
} else {
    Write-Host "[WARN] Dashboard file not found" -ForegroundColor Yellow
}

# Kill processes on ports
Write-Host ""
Write-Host "[INFO] Cleaning up ports..." -ForegroundColor Yellow
Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

# Start proxy
Write-Host "[INFO] Starting proxy server..." -ForegroundColor Yellow
$proxy = Start-Process -FilePath "node" -ArgumentList "xray-proxy-server.js" -WindowStyle Minimized -PassThru

# Wait for proxy
Write-Host "[INFO] Waiting for proxy..." -ForegroundColor Yellow
$ready = $false
for ($i = 1; $i -le 15; $i++) {
    Start-Sleep -Seconds 1
    try {
        $resp = Invoke-WebRequest -Uri "http://localhost:3001/health" -UseBasicParsing -TimeoutSec 1 -ErrorAction Stop
        if ($resp.StatusCode -eq 200) {
            Write-Host "[OK] Proxy ready" -ForegroundColor Green
            $ready = $true
            break
        }
    } catch {
        Write-Host "  Waiting... ($i/15)" -ForegroundColor Yellow
    }
}

# Start file server
Write-Host ""
Write-Host "[INFO] Starting file server..." -ForegroundColor Yellow
try {
    $pythonVer = & python --version 2>$null
    if ($pythonVer) {
        Start-Process -FilePath "python" -ArgumentList "-m http.server 8080" -WindowStyle Minimized
        Write-Host "[OK] Using Python HTTP server" -ForegroundColor Green
    } else {
        throw "Python not found"
    }
} catch {
    Write-Host "[INFO] Using npx http-server" -ForegroundColor Yellow
    Start-Process -FilePath "npx" -ArgumentList "http-server -p 8080 --cors" -WindowStyle Minimized
}

Start-Sleep -Seconds 3

# Open browser
$Url = "http://localhost:8080/"
if ($DashboardFile) { $Url = "http://localhost:8080/$DashboardFile`?proxy=local" }
Write-Host ""
Write-Host "[INFO] Opening: $Url" -ForegroundColor Green
Start-Process $Url

# Show status
Write-Host ""
Write-Host "================================================" -ForegroundColor Cyan
Write-Host "  XRAY DASHBOARD IS RUNNING" -ForegroundColor Green
Write-Host ""
Write-Host "  Dashboard: $Url" -ForegroundColor Yellow
Write-Host "  Proxy:     http://localhost:3001/health" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Close this window to stop all services" -ForegroundColor Yellow
Write-Host "================================================" -ForegroundColor Cyan
Write-Host ""

# Keep running
try {
    while ($true) { Start-Sleep -Seconds 5 }
} finally {
    Write-Host "Stopping services..." -ForegroundColor Yellow
    Get-Process -Name "node" -ErrorAction SilentlyContinue | Stop-Process -Force
    Write-Host "Done" -ForegroundColor Green
}