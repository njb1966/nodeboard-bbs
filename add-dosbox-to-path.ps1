# Add DOSBox to Windows PATH
# Run this script in PowerShell as Administrator

$dosboxPath = "C:\Program Files (x86)\DOSBox-0.74-3"

# Check if DOSBox exists
if (Test-Path "$dosboxPath\DOSBox.exe") {
    Write-Host "Found DOSBox at: $dosboxPath" -ForegroundColor Green

    # Get current PATH
    $currentPath = [Environment]::GetEnvironmentVariable("Path", "Machine")

    # Check if already in PATH
    if ($currentPath -like "*$dosboxPath*") {
        Write-Host "DOSBox is already in your PATH!" -ForegroundColor Yellow
    } else {
        Write-Host "Adding DOSBox to system PATH..." -ForegroundColor Cyan

        # Add to PATH
        $newPath = $currentPath + ";" + $dosboxPath
        [Environment]::SetEnvironmentVariable("Path", $newPath, "Machine")

        Write-Host "DOSBox added to PATH successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "IMPORTANT: You need to restart your terminal/Git Bash for the changes to take effect." -ForegroundColor Yellow
        Write-Host ""
        Write-Host "To verify after restarting, run: dosbox -version" -ForegroundColor Cyan
    }
} else {
    Write-Host "ERROR: DOSBox.exe not found at $dosboxPath" -ForegroundColor Red
    Write-Host "Please verify your DOSBox installation location." -ForegroundColor Red
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
