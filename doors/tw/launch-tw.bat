@echo off
cd /d "%~dp0"

REM Try dosbox from PATH first
where dosbox >nul 2>&1
if %ERRORLEVEL% EQU 0 (
    dosbox -conf dosbox-tw.conf -exit
) else (
    REM Fall back to common installation location
    if exist "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" (
        "C:\Program Files (x86)\DOSBox-0.74-3\DOSBox.exe" -conf dosbox-tw.conf -exit
    ) else (
        echo ERROR: DOSBox not found!
        echo Please install DOSBox or add it to your PATH.
        pause
    )
)
