@echo off
chcp 65001 >nul
title XRAY Dashboard Launcher
color 0A

echo.
echo ================================================
echo    XRAY TEST EXECUTION DASHBOARD LAUNCHER
echo ================================================
echo.

cd /d "%~dp0"

:: Check Node.js
where node >nul 2>&1
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org
    echo.
    pause
    exit /b 1
)
echo [OK] Node.js found
node --version
echo.

:: Check for proxy server file
if not exist "%~dp0xray-proxy-server.js" (
    echo [ERROR] xray-proxy-server.js not found in current directory!
    echo Current: %~dp0
    echo.
    pause
    exit /b 1
)
echo [OK] Proxy server file found
echo.

:: Find dashboard file
set "DASHBOARD_FILE="
if exist "%~dp0xray-test-dashboard.html" set "DASHBOARD_FILE=xray-test-dashboard.html"
if exist "%~dp0dashboard.html" set "DASHBOARD_FILE=dashboard.html"
if exist "%~dp0index.html" set "DASHBOARD_FILE=index.html"
if exist "%~dp0xray-dashboard-prod.html" set "DASHBOARD_FILE=xray-dashboard-prod.html"

if "%DASHBOARD_FILE%"=="" (
    echo [WARN] Dashboard HTML file not found
    echo Looking for: xray-test-dashboard.html, dashboard.html, index.html
    echo Will serve directory listing instead.
) else (
    echo [OK] Found dashboard: %DASHBOARD_FILE%
)
echo.

:: Kill existing processes on ports
echo [INFO] Cleaning up ports...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)
for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 " 2^>nul') do (
    taskkill /f /pid %%a >nul 2>&1
)
timeout /t 2 /nobreak >nul
echo [OK] Ports cleaned
echo.

:: Start proxy server
echo [INFO] Starting proxy server on port 3001...
start "XRAY Proxy Server" /min cmd /c "node xray-proxy-server.js"

:: Wait for proxy to be ready
echo [INFO] Waiting for proxy server...
set /a count=0
:wait_proxy
timeout /t 1 /nobreak >nul
set /a count+=1

:: Check if proxy is responding
curl -s -o nul -w "%%{http_code}" http://localhost:3001/health 2>nul | findstr "200" >nul
if errorlevel 1 (
    if %count% lss 15 goto wait_proxy
    echo [WARN] Proxy timeout after 15 seconds - continuing anyway
) else (
    echo [OK] Proxy server ready
)
echo.

:: Check for Python (different method)
set "USE_PYTHON=0"
python --version >nul 2>&1
if not errorlevel 1 (
    set "USE_PYTHON=1"
    echo [OK] Python found
    python --version
    goto start_file_server
)

py --version >nul 2>&1
if not errorlevel 1 (
    set "USE_PYTHON=1"
    set "PYTHON_CMD=py"
    echo [OK] Python found (py)
    py --version
    goto start_file_server
)

echo [WARN] Python not found, will use Node.js http-server
echo.

:start_file_server
:: Start file server
echo [INFO] Starting file server on port 8080...

if "%USE_PYTHON%"=="1" (
    if "%PYTHON_CMD%"=="" set "PYTHON_CMD=python"
    start "XRAY File Server" /min cmd /c "%PYTHON_CMD% -m http.server 8080"
) else (
    :: Check if npx is available
    where npx >nul 2>&1
    if errorlevel 1 (
        echo [ERROR] Neither Python nor npx found!
        echo Please install Python or run: npm install -g http-server
        pause
        exit /b 1
    )
    start "XRAY File Server" /min cmd /c "npx http-server -p 8080 --cors"
)

timeout /t 3 /nobreak >nul
echo [OK] File server started
echo.

:: Build URL
set "URL=http://localhost:8080/"
if not "%DASHBOARD_FILE%"=="" set "URL=http://localhost:8080/%DASHBOARD_FILE%?proxy=local"

:: Open browser
echo [INFO] Opening dashboard...
start "" "%URL%"

:: Display status
echo.
echo ================================================
echo   XRAY DASHBOARD IS RUNNING
echo.
echo   Dashboard: %URL%
echo   Proxy API: http://localhost:3001/health
echo   Cache:     Enabled (5 min TTL)
echo.
echo   To stop:   Close this window (Ctrl+C)
echo ================================================
echo.

:: Keep window open
echo Press Ctrl+C to stop all services...
echo.

:loop
timeout /t 5 /nobreak >nul
goto loop