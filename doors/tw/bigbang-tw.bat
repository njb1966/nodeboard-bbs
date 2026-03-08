@echo off
echo ================================================================
echo TradeWars 2002 - Universe Generator (BIGBANG.EXE)
echo ================================================================
echo.
echo This will create the TradeWars universe:
echo   - Generate sectors
echo   - Create ports
echo   - Initialize game data
echo.
echo WARNING: This will overwrite existing game data!
echo Only run this for a NEW game setup.
echo.
echo Press CTRL+C to cancel, or any key to continue...
pause >nul

cd /d "%~dp0"

REM Check if SHARE.EXE exists
if not exist "SHARE.EXE" (
    echo.
    echo ERROR: SHARE.EXE is required but not found!
    echo.
    echo To download SHARE.EXE, run:
    echo    powershell -ExecutionPolicy Bypass -File download-share.ps1
    echo.
    pause
    exit /b 1
)

REM Try dosbox from PATH first
where dosbox >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    dosbox -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "BIGBANG.EXE"
) else (
    if exist "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" (
        "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "BIGBANG.EXE"
    ) else (
        echo ERROR: DOSBox not found!
        pause
    )
)

echo.
echo Universe generation complete!
pause
