# Quick Start Guide

## For Windows Users

### Step 1: Install Node.js

1. Download Node.js from: https://nodejs.org/ (LTS version recommended)
2. Run the installer and follow the prompts
3. Restart your command prompt/PowerShell after installation

### Step 2: Run Setup

Open **Command Prompt** or **PowerShell** (NOT Git Bash) and run:

```cmd
cd E:\custombbs
setup.bat
```

This will:
- Install all dependencies
- Create the database
- Set up default forums and file areas
- Create the default sysop account

### Step 3: Start the BBS

```cmd
start.bat
```

Or:

```cmd
npm start
```

### Step 4: Connect

**Via Telnet:**
1. Open another Command Prompt
2. Run: `telnet localhost 2323`
3. Login with: `sysop` / `sysop`

**Via Web Browser:**
1. Open your browser
2. Go to: http://localhost:3000

## For Linux/Ubuntu Users

### Step 1: Install Node.js

```bash
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs
```

### Step 2: Run Setup

```bash
npm install
npm run init-db
```

### Step 3: Start the BBS

```bash
npm start
```

### Step 4: Connect

```bash
telnet localhost 2323
```

Login with: `sysop` / `sysop`

## Default Credentials

**IMPORTANT:** Change these after first login!

- Username: `sysop`
- Password: `sysop`

## Features

- **Message Forums** - Post and read messages in topic-based forums
- **Private Mail** - Send private messages to other users
- **File Areas** - Upload and download files
- **DOOR Games** - Play classic BBS door games
- **User List** - See all registered users
- **Who's Online** - See currently connected users
- **Bulletins** - Read system announcements
- **User Settings** - Customize your profile and preferences

## Navigation

The BBS uses letter-based commands:
- Type the letter shown in brackets (e.g., `M` for Message Forums)
- Press Enter to submit
- Type `Q` to quit/go back to previous menu

## Customization

### Change BBS Name

Edit `.env` file:
```
BBS_NAME="Your BBS Name Here"
```

### Change Ports

Edit `.env` file:
```
BBS_PORT=2323
WEB_PORT=3000
```

### Add DOOR Games

1. Place game files in `./doors/gamename/`
2. Add to database (see INSTALL.md for details)

## Troubleshooting

### "Cannot find module" errors

Run: `npm install`

### "Database not found" error

Run: `npm run init-db`

### Port already in use

Change ports in `.env` file or close the program using that port

### On Windows: "telnet is not recognized"

Enable Telnet Client:
1. Open "Turn Windows features on or off"
2. Check "Telnet Client"
3. Click OK and restart Command Prompt

Or use PuTTY: https://www.putty.org/

## Next Steps

1. Login as sysop and change the default password
2. Explore the message forums
3. Read the bulletins
4. Customize your BBS settings
5. Invite friends to connect!

## Need Help?

See `INSTALL.md` for detailed installation and configuration instructions.

Enjoy your BBS!
