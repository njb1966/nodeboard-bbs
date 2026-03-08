# TradeWars 2002 Setup Guide

## Overview
TradeWars 2002 is a classic DOS-based BBS door game. To run it on modern systems, you'll need DOSBox.

## Installation Steps

### 1. Install DOSBox
Download and install DOSBox from: https://www.dosbox.com/download.php?main=1

**Windows Installation:**
- Download the Windows installer
- Install to the default location: `C:\Program Files (x86)\DOSBox-0.74-3\`
- Add DOSBox to your system PATH:
  - Right-click "This PC" > Properties > Advanced System Settings
  - Click "Environment Variables"
  - Under "System variables", find and select "Path"
  - Click "Edit" > "New"
  - Add: `C:\Program Files (x86)\DOSBox-0.74-3\`
  - Click OK to save

### 2. Configure TradeWars 2002

The game files are already in place in `doors/tw/`. The configuration files included are:

- **TW2002.EXE** - Main game executable
- **TWCFIG.DAT** - Game configuration
- **dosbox-tw.conf** - DOSBox configuration for running TradeWars

### 3. Update Database

TradeWars 2002 should be automatically added to the database when you initialize it. If you need to add it manually, run:

```bash
node add-tradewars.js
```

Or reinitialize the database:

```bash
npm run init-db
```

### 4. Update Door Configuration

Edit the doors table in the database to use DOSBox:

**Option A: Using DOSBox directly**
```sql
UPDATE doors
SET command = 'dosbox -conf dosbox-tw.conf -exit'
WHERE name = 'TradeWars 2002';
```

**Option B: Using a wrapper script**
Update the command field to use the launch script (see below).

### 5. Create Launch Script (Recommended)

Create `doors/tw/launch-tw.bat`:

```batch
@echo off
cd /d "%~dp0"
dosbox -conf dosbox-tw.conf -exit
```

Then update the database:
```sql
UPDATE doors
SET command = 'launch-tw.bat'
WHERE name = 'TradeWars 2002';
```

### 6. Node Configuration for DOS Doors

The NodeBoard BBS DoorService needs to be configured to properly handle DOS games. The current implementation pipes stdio between the BBS and the door game.

**Important Notes:**
- DOSBox doesn't support stdio redirection in the traditional sense
- For proper BBS integration, you may need:
  - A telnet-enabled door launcher like GameSrv
  - Or use FOSSIL driver emulation
  - Or configure TradeWars to run in local mode for testing

### 7. Testing TradeWars

To test TradeWars 2002 outside the BBS:

```bash
cd doors/tw
dosbox -conf dosbox-tw.conf
```

This will launch TradeWars in DOSBox. You should see the game menu.

### 8. Game Configuration

Use the TradeWars configuration editor:

```bash
cd doors/tw
dosbox
# Inside DOSBox:
TEDIT.EXE
```

Configure settings like:
- Number of ports
- Number of sectors
- Game difficulty
- Multi-node settings

## Troubleshooting

### DOSBox not found
- Verify DOSBox is installed
- Check that DOSBox is in your system PATH
- Try using the full path: `C:\Program Files (x86)\DOSBox-0.74-3\dosbox.exe`

### Game doesn't start from BBS
- Test the game manually first using DOSBox
- Check the working_dir in the doors table
- Verify file permissions
- Check BBS logs for error messages

### Configuration Issues
- Run TEDIT.EXE to reconfigure the game
- Check TWCFIG.DAT for proper settings
- Ensure node numbers are configured correctly

## Alternative: GameSrv

For better BBS integration, consider using GameSrv (a telnet-to-DOS door server):

1. Download GameSrv from: http://www.gamers.org/dEngine/rlogin/
2. Configure GameSrv to launch TradeWars
3. Update the door command to telnet to GameSrv
4. This provides proper ANSI/telnet integration

## File Descriptions

- **TW2002.EXE** - Main game executable
- **TW2002.OVR** - Game overlay file (required)
- **TWCFIG.DAT** - Game configuration
- **TWNODE.DAT** - Node information
- **TWUSER.DAT** - Player data
- **TWSHIP.DAT** - Ship data
- **TWSECT.DAT** - Sector data
- **TWPORT.DAT** - Port data
- **TEDIT.EXE** - Configuration editor
- **BIGBANG.EXE** - Universe generator

## Resources

- TradeWars 2002 Documentation: See TWINSTR.DOC
- Sysop Guide: See TWSYSOP.DOC
- What's New: See WHATSNEW.DOC

## Support

For issues specific to TradeWars 2002, refer to the included documentation files or visit classic BBS gaming communities online.
