@echo off
cd /d "%~dp0"

echo Testing TradeWars 2002 launch...
echo.

REM Try dosbox from PATH first
where dosbox >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using DOSBox from PATH
    dosbox -conf dosbox-tw.conf
) else (
    REM Fall back to common installation location
    if exist "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" (
        echo Using DOSBox from: C:\Program Files (x86)\DOSBox-0.74-3\
        "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" -conf dosbox-tw.conf
    ) else (
        echo ERROR: DOSBox not found!
        echo Please install DOSBox or add it to your PATH.
        pause
    )
)

echo.
echo DOSBox closed. Press any key to exit...
pause >nul
