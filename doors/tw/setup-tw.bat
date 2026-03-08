@echo off
echo ================================================================
echo TradeWars 2002 - Configuration Setup
echo ================================================================
echo.
echo This will launch the TradeWars configuration editor (TEDIT.EXE)
echo.
echo You need to configure:
echo   1. Node settings
echo   2. Game parameters
echo   3. BBS interface options
echo.
echo Press any key to launch TEDIT...
pause >nul

cd /d "%~dp0"

REM Check if SHARE.EXE exists
if not exist "SHARE.EXE" (
    echo.
    echo ERROR: SHARE.EXE is required but not found!
    echo.
    echo SHARE.EXE is needed for TradeWars to run.
    echo.
    echo To download SHARE.EXE automatically, run:
    echo    powershell -ExecutionPolicy Bypass -File download-share.ps1
    echo.
    echo Or download manually from:
    echo    https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/dos/share/
    echo.
    pause
    exit /b 1
)

REM Try dosbox from PATH first
where dosbox >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    dosbox -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "TEDIT.EXE"
) else (
    if exist "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" (
        "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "TEDIT.EXE"
    ) else (
        echo ERROR: DOSBox not found!
        pause
    )
)
