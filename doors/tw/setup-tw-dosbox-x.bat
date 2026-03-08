@echo off
echo ================================================================
echo TradeWars 2002 - Configuration Setup (DOSBox-X)
echo ================================================================
echo.
echo This will launch the TradeWars configuration editor using DOSBox-X
echo DOSBox-X has built-in SHARE support - no separate SHARE.EXE needed!
echo.
echo Press any key to launch TEDIT...
pause >nul

cd /d "%~dp0"

REM Check for DOSBox-X
where dosbox-x >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using DOSBox-X from PATH
    dosbox-x -conf dosbox-tw.conf -c "TEDIT.EXE"
    goto :done
)

REM Check common DOSBox-X installation locations
if exist "C:\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\DOSBox-X\
    "C:\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf -c "TEDIT.EXE"
    goto :done
)

if exist "C:\Program Files\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\Program Files\DOSBox-X\
    "C:\Program Files\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf -c "TEDIT.EXE"
    goto :done
)

if exist "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\Program Files (x86)\DOSBox-X\
    "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf -c "TEDIT.EXE"
    goto :done
)

REM DOSBox-X not found
echo.
echo ERROR: DOSBox-X not found!
echo.
echo Please install DOSBox-X from: https://dosbox-x.com/
echo.
echo Or specify the path to dosbox-x.exe in this script.
echo.
pause
exit /b 1

:done
echo.
echo TEDIT closed.
pause
