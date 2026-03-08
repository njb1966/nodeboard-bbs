@echo off
echo ========================================================================
echo TradeWars 2002 - First Time Setup
echo ========================================================================
echo.
echo This script will:
echo   1. Check for SHARE.EXE (required DOS utility)
echo   2. Download it if missing
echo   3. Launch the TradeWars configuration editor
echo.
echo Press any key to begin setup...
pause >nul

cd /d "%~dp0"

REM Check if SHARE.EXE exists
if not exist "SHARE.EXE" (
    echo.
    echo [STEP 1/2] SHARE.EXE not found - downloading...
    echo.

    REM Try to download using PowerShell
    powershell -ExecutionPolicy Bypass -Command "& { $url = 'https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/dos/share/1.03/share.zip'; $zip = 'share.zip'; Invoke-WebRequest -Uri $url -OutFile $zip -UseBasicParsing; Expand-Archive -Path $zip -DestinationPath '.' -Force; if (Test-Path 'share\SHARE.EXE') { Move-Item 'share\SHARE.EXE' '.' -Force }; Remove-Item $zip -Force -ErrorAction SilentlyContinue; Remove-Item 'share' -Recurse -Force -ErrorAction SilentlyContinue }"

    if exist "SHARE.EXE" (
        echo.
        echo SUCCESS: SHARE.EXE downloaded!
        echo.
    ) else (
        echo.
        echo ERROR: Could not download SHARE.EXE automatically.
        echo.
        echo Please download manually:
        echo   1. Visit: https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/dos/share/
        echo   2. Download share.zip
        echo   3. Extract SHARE.EXE to this folder: %CD%
        echo   4. Run this script again
        echo.
        pause
        exit /b 1
    )
) else (
    echo.
    echo [CHECK] SHARE.EXE found - ready to configure!
    echo.
)

echo [STEP 2/2] Launching TradeWars configuration editor...
echo.
pause

REM Launch TEDIT
where dosbox >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    dosbox -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "TEDIT.EXE"
) else (
    if exist "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" (
        "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "TEDIT.EXE"
    ) else (
        echo ERROR: DOSBox not found!
        pause
        exit /b 1
    )
)

echo.
echo ========================================================================
echo Configuration complete!
echo.
echo NEXT STEPS:
echo   1. Run: bigbang-tw.bat  (to initialize the game universe)
echo   2. Run: test-tw.bat     (to test the game)
echo.
echo See QUICKSTART.txt for detailed instructions.
echo ========================================================================
pause
