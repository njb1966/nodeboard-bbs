@echo off
cls
echo ================================================================================
echo TradeWars 2002 - BBS Integration Guide
echo ================================================================================
echo.
echo Your TradeWars 2002 is CONFIGURED in DOSBox-X!
echo.
echo ================================================================================
echo NEXT STEPS:
echo ================================================================================
echo.
echo 1. Generate Universe (ONE TIME ONLY)
echo    Run: bigbang-tw-dosbox-x.bat
echo    This creates all sectors and ports (takes 1-2 minutes)
echo.
echo 2. Test the Game
echo    Run: test-tw-dosbox-x.bat
echo    Game should launch and show main menu
echo.
echo 3. Add to BBS Database
echo    From main BBS folder: node add-tradewars.js
echo.
echo 4. Start BBS
echo    From main BBS folder: npm start
echo.
echo 5. Connect and Test
echo    telnet localhost 2323
echo    Navigate to Door Games menu
echo.
echo ================================================================================
echo IMPORTANT:
echo ================================================================================
echo.
echo TradeWars will launch in a SEPARATE DOSBox-X window on the server.
echo It will NOT display in the user's telnet session (current limitation).
echo.
echo For remote telnet access, you'll need NetFoss/GameSrv or similar.
echo See BBS-INTEGRATION.txt for details.
echo.
echo ================================================================================
echo.
echo Press any key to exit...
pause >nul
