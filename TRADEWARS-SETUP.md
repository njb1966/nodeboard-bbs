# TradeWars 2002 Configuration Complete!

## Status: TradeWars 2002 Configured! ✓

TradeWars is now configured in DOSBox-X and ready for BBS integration.

## What I've Done

I've configured TradeWars 2002 to work with your NodeBoard BBS system:

### 1. Database Configuration
- Added TradeWars 2002 to the default doors in `src/database/schema.js`
- Updated `src/database/init.js` to automatically insert door games on initialization
- The game will be added automatically when you run `npm run init-db` or start fresh

### 2. Created Launch Files
- **`doors/tw/launch-tw.bat`** - Batch file to launch TradeWars via DOSBox
- **`doors/tw/dosbox-tw.conf`** - DOSBox configuration optimized for TradeWars
- **`doors/tw/README-SETUP.md`** - Detailed setup instructions

### 3. Helper Script
- **`add-tradewars.js`** - Script to add/update TradeWars in an existing database

## ✅ Game Configured - Next Steps for BBS Integration

Your TradeWars 2002 is configured in DOSBox-X! Follow these steps:

### 1. Generate the Universe
```bash
cd doors/tw
./bigbang-tw-dosbox-x.bat
```
This creates all sectors, ports, and game data. **Only run once!**

### 2. Test the Game
```bash
./test-tw-dosbox-x.bat
```
Game should launch and show the main menu.

### 3. Add to BBS Database
```bash
cd ../..  # Back to main BBS folder
node add-tradewars.js
```

### 4. Start BBS and Test
```bash
npm start
```
Then connect: `telnet localhost 2323`

Navigate to Door Games → TradeWars 2002

**See `doors/tw/NEXT-STEPS-CHECKLIST.txt` for detailed checklist.**

**See `doors/tw/BBS-INTEGRATION.txt` for important integration notes.**

---

## Original Setup Guide (Reference)

## Quick Start

### Step 1: Install DOSBox
Download and install DOSBox from: https://www.dosbox.com/download.php?main=1

**Windows:** Install to default location and add to PATH:
```
C:\Program Files (x86)\DOSBox-0.74-3\
```

### Step 2: Download SHARE.EXE (Required)
TradeWars requires SHARE.EXE (a DOS file-locking utility). Run the automated installer:

```bash
cd doors/tw
./INSTALL-FIRST.bat
```

This will:
- Download SHARE.EXE automatically from FreeDOS
- Launch the TradeWars configuration editor (TEDIT)
- Guide you through initial setup

**Or download SHARE.EXE manually:**
```bash
cd doors/tw
powershell -ExecutionPolicy Bypass -File download-share.ps1
```

### Step 3: Add TradeWars to Database

**Option A: Reinitialize database (if starting fresh)**
```bash
npm run init-db
```

**Option B: Add to existing database**
```bash
node add-tradewars.js
```

### Step 4: Initialize the Universe
After configuring in TEDIT, generate the game universe:

```bash
cd doors/tw
./bigbang-tw.bat
```

This creates all sectors, ports, and game data.

### Step 5: Test TradeWars
Test that the game launches properly:

```bash
cd doors/tw
./test-tw.bat
```

You should see TradeWars 2002 start and show the main menu!

### Step 6: Access from BBS
1. Start your BBS: `npm start`
2. Connect via telnet
3. Navigate to Door Games menu
4. Select "TradeWars 2002"

## Important Notes

### Current Limitations
The NodeBoard DoorService uses stdio piping to communicate with door games. However, **DOSBox doesn't support stdio redirection** in the traditional way, which means:

- The game will launch in a separate DOSBox window
- Input/output won't be properly connected to the telnet session
- Users will interact directly with the DOSBox window, not through the BBS

### Recommended Solution for Production

For proper BBS integration, you have a few options:

#### Option 1: Use GameSrv (Recommended for Windows)
GameSrv is a telnet-to-DOS door server:
1. Download from: http://www.gamers.org/dEngine/rlogin/
2. Configure GameSrv to launch TradeWars
3. Update door command to connect to GameSrv via telnet
4. This provides proper ANSI/telnet integration

#### Option 2: Use dosemu2 (Linux/WSL)
If running on Linux or WSL:
1. Install dosemu2
2. Configure it to run TradeWars
3. Use proper drop file support

#### Option 3: Local Testing Mode
For testing/single-user:
- Launch TradeWars manually from DOSBox
- Play locally (not through BBS)
- This works for testing game configuration

### Files in doors/tw/

Game files:
- `TW2002.EXE` - Main executable
- `TEDIT.EXE` - Configuration editor
- `BIGBANG.EXE` - Universe generator
- `*.DAT` - Game data files

Configuration:
- `TWCFIG.DAT` - Game configuration
- `dosbox-tw.conf` - DOSBox settings
- `launch-tw.bat` - Launch script

Documentation:
- `TWINSTR.DOC` - Instructions
- `TWSYSOP.DOC` - Sysop guide
- `WHATSNEW.DOC` - Version info

## Troubleshooting

### "dosbox: command not found"
- Install DOSBox (see Step 1 above)
- Add DOSBox to your system PATH
- Or use full path in launch-tw.bat

### Game doesn't appear in BBS menu
- Check that doors were added to database
- Run: `node add-tradewars.js`
- Verify with BBS sysop menu

### Game launches but disconnects user
- This is expected with current DoorService implementation
- DOSBox opens separately from BBS connection
- See "Recommended Solution for Production" above

### Need to reconfigure game
```bash
cd doors/tw
dosbox
# In DOSBox:
TEDIT.EXE
```

## Next Steps

1. **Install DOSBox** if not already installed
2. **Test the game** manually with `launch-tw.bat`
3. **Add to database** with `node add-tradewars.js` or `npm run init-db`
4. **Try from BBS** to see current behavior
5. **Consider GameSrv** for production use with proper BBS integration

## Additional Resources

See `doors/tw/README-SETUP.md` for more detailed information.

TradeWars 2002 documentation is in the `doors/tw/` folder:
- TWINSTR.DOC - Player instructions
- TWSYSOP.DOC - Sysop guide
- WHATSNEW.DOC - Update notes

---

**Need Help?**
- Check the documentation files in `doors/tw/`
- Visit classic BBS gaming communities
- Research GameSrv for proper telnet integration
