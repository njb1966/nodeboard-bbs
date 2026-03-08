@echo off
echo ================================================================
echo TradeWars 2002 - Universe Generator (DOSBox-X)
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

REM Check for DOSBox-X
where dosbox-x >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    echo Using DOSBox-X from PATH
    dosbox-x -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "BIGBANG.EXE"
    goto :done
)

REM Check common DOSBox-X installation locations
if exist "C:\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\DOSBox-X\
    "C:\DOSBox-X\dosbox-x.exe" -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "BIGBANG.EXE"
    goto :done
)

if exist "C:\Program Files\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\Program Files\DOSBox-X\
    "C:\Program Files\DOSBox-X\dosbox-x.exe" -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "BIGBANG.EXE"
    goto :done
)

if exist "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" (
    echo Using DOSBox-X from C:\Program Files (x86)\DOSBox-X\
    "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" -c "mount c: ." -c "c:" -c "SHARE.EXE" -c "BIGBANG.EXE"
    goto :done
)

REM DOSBox-X not found
echo.
echo ERROR: DOSBox-X not found!
echo Please install DOSBox-X from: https://dosbox-x.com/
pause
exit /b 1

:done
echo.
echo Universe generation complete!
echo.
echo NEXT: Run test-tw-dosbox-x.bat to test the game
pause
