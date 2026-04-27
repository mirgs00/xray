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

 

:: ------------------------------------------------

:: Check Node.js

:: ------------------------------------------------

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

 

:: ------------------------------------------------

:: Check for proxy server

:: ------------------------------------------------

if not exist "%~dp0xray-proxy-server.js" (

    echo [ERROR] xray-proxy-server.js not found!

    echo Expected location: %~dp0

    echo.

    pause

    exit /b 1

)

echo [OK] Proxy server file found

echo.

 

:: ------------------------------------------------

:: Find latest dashboard file (xray-test-dashboard-v*.html)

:: ------------------------------------------------

set "DASHBOARD_FILE="

 

for /f "delims=" %%F in (

  'dir /b /o-n "%~dp0xray-test-dashboard-v*.html" 2^>nul'

) do (

  set "DASHBOARD_FILE=%%F"

  goto dashboard_found

)

 

:dashboard_found

if "%DASHBOARD_FILE%"=="" (

    echo [WARN] No versioned dashboard file found

    echo Looking for: xray-test-dashboard-v*.html

    echo A directory listing will be opened instead.

) else (

    echo [OK] Latest dashboard detected: %DASHBOARD_FILE%

)

echo.

 

:: ------------------------------------------------

:: Kill existing processes on ports

:: ------------------------------------------------

echo [INFO] Cleaning up ports 3001 and 8080...

 

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":3001 " 2^>nul') do (

    taskkill /f /pid %%a >nul 2>&1

)

 

for /f "tokens=5" %%a in ('netstat -aon ^| findstr ":8080 " 2^>nul') do (

    taskkill /f /pid %%a >nul 2>&1

)

 

timeout /t 2 /nobreak >nul

echo [OK] Ports cleaned

echo.

 

:: ------------------------------------------------

:: Start proxy server

:: ------------------------------------------------

echo [INFO] Starting XRAY proxy server (port 3001)...

start "XRAY Proxy Server" /min cmd /c "node xray-proxy-server.js"

 

:: ------------------------------------------------

:: Wait for proxy health endpoint (optional but recommended)

:: ------------------------------------------------

set COUNT=0

where curl >nul 2>&1

if errorlevel 1 (

    echo [WARN] curl not found - skipping proxy health check

    goto proxy_check_done

)

 

echo [INFO] Waiting for proxy readiness...

:wait_proxy

timeout /t 1 /nobreak >nul

set /a COUNT+=1

 

curl -s http://localhost:3001/health | findstr "ok" >nul

if errorlevel 1 (

    if %COUNT% lss 15 goto wait_proxy

    echo [WARN] Proxy health check timed out - continuing anyway

) else (

    echo [OK] Proxy server is responsive

)

 

:proxy_check_done

echo.

 

:: ------------------------------------------------

:: Determine file server method

:: ------------------------------------------------

set "USE_PYTHON=0"

set "PYTHON_CMD="

 

python --version >nul 2>&1

if not errorlevel 1 (

    set "USE_PYTHON=1"

    set "PYTHON_CMD=python"

)

 

py --version >nul 2>&1

if not errorlevel 1 (

    set "USE_PYTHON=1"

    set "PYTHON_CMD=py"

)

 

:: ------------------------------------------------

:: Start file server on port 8080

:: ------------------------------------------------

echo [INFO] Starting file server on port 8080...

 

if "%USE_PYTHON%"=="1" (

    echo [OK] Using Python http.server

    start "XRAY File Server" /min cmd /c "%PYTHON_CMD% -m http.server 8080"

) else (

    where npx >nul 2>&1

    if errorlevel 1 (

        echo [ERROR] Neither Python nor npx is available!

        echo Install Python OR run: npm install -g http-server

        pause

        exit /b 1

    )

    echo [OK] Using Node http-server

    start "XRAY File Server" /min cmd /c "npx http-server -p 8080 --cors"

)

 

timeout /t 3 /nobreak >nul

echo [OK] File server started

echo.

 

:: ------------------------------------------------

:: Build URL

:: ------------------------------------------------

set "URL=http://localhost:8080/"

if not "%DASHBOARD_FILE%"=="" (

    set "URL=http://localhost:8080/%DASHBOARD_FILE%?proxy=local"

)

 

:: ------------------------------------------------

:: Open browser

:: ------------------------------------------------

echo [INFO] Opening dashboard...

start "" "%URL%"

 

:: ------------------------------------------------

:: Status banner

:: ------------------------------------------------

echo.

echo ================================================

echo   XRAY DASHBOARD IS RUNNING

echo.

echo   Dashboard: %URL%

echo   Proxy API: http://localhost:3001/health

echo.

echo   To stop:   Close this window (Ctrl+C)

echo ================================================

echo.

 

:: ------------------------------------------------

:: Keep session alive

:: ------------------------------------------------

echo Press Ctrl+C to stop all services...

echo.

 

:loop

timeout /t 5 /nobreak >nul

goto loop