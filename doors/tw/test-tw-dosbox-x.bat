@echo off
echo ================================================================
echo TradeWars 2002 - Test Launch (DOSBox-X)
echo ================================================================
echo.
echo This will launch TradeWars using DOSBox-X
echo DOSBox-X has built-in SHARE support!
echo.
pause

cd /d "%~dp0"

REM Check for DOSBox-X
where dosbox-x >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using DOSBox-X from PATH
    dosbox-x -conf dosbox-tw.conf
    goto :done
)

REM Check common DOSBox-X installation locations
if exist "C:\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\DOSBox-X\
    "C:\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf
    goto :done
)

if exist "C:\Program Files\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\Program Files\DOSBox-X\
    "C:\Program Files\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf
    goto :done
)

if exist "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\Program Files (x86)\DOSBox-X\
    "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf
    goto :done
)

REM DOSBox-X not found
echo.
echo ERROR: DOSBox-X not found!
echo.
echo Please install DOSBox-X from: https://dosbox-x.com/
echo.
pause
exit /b 1

:done
echo.
echo TradeWars closed.
pause
