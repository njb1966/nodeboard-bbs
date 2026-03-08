@echo off
echo ===============================================
echo Custom BBS - Setup Script for Windows
echo ===============================================
echo.

REM Check if Node.js is installed
where node >nul 2>&1
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Node.js is not installed!
    echo.
    echo Please download and install Node.js from:
    echo https://nodejs.org/
    echo.
    echo After installation, run this script again.
    pause
    exit /b 1
)

echo Node.js found:
node --version
echo npm version:
npm --version
echo.

echo [1/3] Installing dependencies...
call npm install
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to install dependencies
    pause
    exit /b 1
)
echo.

echo [2/3] Initializing database...
call npm run init-db
if %ERRORLEVEL% NEQ 0 (
    echo ERROR: Failed to initialize database
    pause
    exit /b 1
)
echo.

echo [3/3] Setup complete!
echo.
echo ===============================================
echo Your BBS is ready to run!
echo ===============================================
echo.
echo To start the BBS, run: npm start
echo.
echo Default sysop credentials:
echo   Username: sysop
echo   Password: sysop
echo.
echo Connect via:
echo   Telnet: telnet localhost 2323
echo   Web:    http://localhost:3000
echo.
pause
