@echo off
cd /d "%~dp0"

REM Try dosbox-x from PATH first
where dosbox-x >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    dosbox-x -conf dosbox-tw.conf -exit
) else (
    REM Check common DOSBox-X installation locations
    if exist "C:\DOSBox-X\dosbox-x.exe" (
        "C:\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf -exit
    ) else if exist "C:\Program Files\DOSBox-X\dosbox-x.exe" (
        "C:\Program Files\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf -exit
    ) else if exist "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" (
        "C:\Program Files (x86)\DOSBox-X\dosbox-x.exe" -conf dosbox-tw.conf -exit
    ) else (
        echo ERROR: DOSBox-X not found!
        echo Please install DOSBox-X from: https://dosbox-x.com/
        pause
        exit /b 1
    )
)
