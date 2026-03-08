# Download SHARE.EXE from FreeDOS
# This is a legitimate DOS file-sharing utility

Write-Host "Downloading SHARE.EXE from FreeDOS repository..." -ForegroundColor Cyan
Write-Host ""

$shareUrl = "https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/dos/share/1.03/share.zip"
$zipPath = "share.zip"
$currentDir = Split-Path -Parent $MyInvocation.MyCommand.Path

try {
    # Download the ZIP file
    Write-Host "Downloading from: $shareUrl" -ForegroundColor Yellow
    Invoke-WebRequest -Uri $shareUrl -OutFile $zipPath -UseBasicParsing
    Write-Host "Download complete!" -ForegroundColor Green
    Write-Host ""

    # Extract SHARE.EXE
    Write-Host "Extracting SHARE.EXE..." -ForegroundColor Yellow
    Expand-Archive -Path $zipPath -DestinationPath "." -Force

    # Check if extraction was successful
    if (Test-Path "SHARE.EXE") {
        Write-Host "SUCCESS: SHARE.EXE extracted successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "File location: $currentDir\SHARE.EXE" -ForegroundColor Cyan
    } elseif (Test-Path "share\SHARE.EXE") {
        Move-Item "share\SHARE.EXE" "." -Force
        Write-Host "SUCCESS: SHARE.EXE extracted successfully!" -ForegroundColor Green
        Write-Host ""
        Write-Host "File location: $currentDir\SHARE.EXE" -ForegroundColor Cyan
    } else {
        Write-Host "WARNING: SHARE.EXE not found after extraction." -ForegroundColor Yellow
        Write-Host "Please check the extracted files manually." -ForegroundColor Yellow
    }

    # Cleanup
    Remove-Item $zipPath -Force -ErrorAction SilentlyContinue

    Write-Host ""
    Write-Host "You can now run setup-tw.bat to configure TradeWars!" -ForegroundColor Green

} catch {
    Write-Host "ERROR: Failed to download SHARE.EXE" -ForegroundColor Red
    Write-Host "Error details: $_" -ForegroundColor Red
    Write-Host ""
    Write-Host "Manual download instructions:" -ForegroundColor Yellow
    Write-Host "1. Visit: https://www.ibiblio.org/pub/micro/pc-stuff/freedos/files/dos/share/" -ForegroundColor Cyan
    Write-Host "2. Download SHARE.ZIP" -ForegroundColor Cyan
    Write-Host "3. Extract SHARE.EXE to: $currentDir" -ForegroundColor Cyan
}

Write-Host ""
Write-Host "Press any key to continue..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
