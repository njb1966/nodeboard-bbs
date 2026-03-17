# NodeBoard BBS - Installation Guide

This guide will help you install and run your custom BBS system on Ubuntu 20.04 or Windows.

## Prerequisites

### System Packages

**Ubuntu/Debian:**
```bash
sudo apt-get install -y lrzsz
```

**RHEL/Fedora:**
```bash
sudo dnf install -y lrzsz
```

`lrzsz` provides the `sz`/`rz` binaries used for ZMODEM file transfers. Without it, uploads and downloads in the file areas will not work.

### Node.js
You need Node.js 18 or higher installed.

**Ubuntu 20.04:**
```bash
# Update package list
sudo apt update

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt-get install -y nodejs

# Verify installation
node --version
npm --version
```

**Windows:**
Download and install Node.js from https://nodejs.org/ (LTS version recommended)

## Installation Steps

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

The `.env` file has been created with default settings. Edit it if needed:

```bash
# On Linux/Mac
nano .env

# On Windows
notepad .env
```

Key settings:
- `BBS_NAME`: Your BBS name
- `BBS_PORT`: Telnet port (default: 2323)
- `WEB_PORT`: Web interface port (default: 3000)

### 3. Initialize Database

```bash
npm run init-db
```

This creates:
- Database file at `./data/bbs.db`
- Default sysop user (username: `sysop`, password: `sysop`)
- Default forums and file areas
- Welcome bulletin

**IMPORTANT:** Change the sysop password after first login!

### 4. Start the BBS

```bash
npm start
```

You should see:
```
═══════════════════════════════════════════════════════
  NodeBoard BBS System
  Version 1.1
═══════════════════════════════════════════════════════

Starting Telnet Server...
Telnet BBS server listening on port 2323
Connect with: telnet localhost 2323
Starting Web Server...
Web server listening on port 3000
Access at: http://localhost:3000

═══════════════════════════════════════════════════════
  BBS is now running!
═══════════════════════════════════════════════════════

  Telnet Access:  telnet localhost 2323
  Web Access:     http://localhost:3000

  Press Ctrl+C to stop the server
```

## Connecting to Your BBS

### Via Telnet

**Linux/Mac:**
```bash
telnet localhost 2323
```

**Windows:**
1. Enable Telnet Client:
   - Open "Turn Windows features on or off"
   - Check "Telnet Client"
   - Click OK

2. Connect:
```cmd
telnet localhost 2323
```

**Alternative Telnet Clients:**
- PuTTY (Windows): https://www.putty.org/
- SyncTERM (Cross-platform): https://syncterm.bbsdev.net/
- NetRunner (Windows): http://www.mysticbbs.com/downloads.html

### Via Web Browser

Open your browser and go to:
```
http://localhost:3000
```

## Running on Ubuntu Server

### Making the BBS Accessible from the Internet

1. **Configure Firewall:**
```bash
# Allow telnet port
sudo ufw allow 2323/tcp

# Allow web port
sudo ufw allow 3000/tcp

# Enable firewall if not already enabled
sudo ufw enable
```

2. **Find Your Server IP:**
```bash
ip addr show
```

3. **Connect from another computer:**
```bash
telnet YOUR_SERVER_IP 2323
```

### Running as a Service (systemd)

Create a systemd service file:

```bash
sudo nano /etc/systemd/system/custombbs.service
```

Add:
```ini
[Unit]
Description=NodeBoard BBS System
After=network.target

[Service]
Type=simple
User=YOUR_USERNAME
WorkingDirectory=/path/to/custombbs
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

Enable and start:
```bash
sudo systemctl enable custombbs
sudo systemctl start custombbs
sudo systemctl status custombbs
```

### Using PM2 (Process Manager)

```bash
# Install PM2
sudo npm install -g pm2

# Start BBS
pm2 start src/index.js --name custombbs

# Save configuration
pm2 save

# Setup auto-start on boot
pm2 startup
```

## Setting Up DOOR Games

1. Create a door directory:
```bash
mkdir -p doors/tradewars
mkdir -p doors/lord
```

2. Place your DOOR game executables in the respective directories

3. Add the door to the database:
```sql
INSERT INTO doors (name, description, command, working_dir, security_level)
VALUES ('TradeWars 2002', 'Classic space trading game', './tw2002', './doors/tradewars', 10);
```

4. Make sure the door executable has proper permissions:
```bash
chmod +x doors/tradewars/tw2002
```

## Port Configuration

### Using Standard Telnet Port (23)

To use port 23, you need root privileges:

```bash
# Option 1: Run with sudo (not recommended for production)
sudo npm start

# Option 2: Use port forwarding (recommended)
sudo iptables -t nat -A PREROUTING -p tcp --dport 23 -j REDIRECT --to-port 2323
```

### Using Different Ports

Edit `.env`:
```
BBS_PORT=8023
WEB_PORT=8080
```

## Troubleshooting

### Database Issues

If you see "Database not found" error:
```bash
npm run init-db
```

### Port Already in Use

Change ports in `.env` file or kill the process using the port:
```bash
# Find process using port
sudo lsof -i :2323

# Kill process
kill -9 PID
```

### Permission Denied

On Linux, ports below 1024 require root:
```bash
# Either use sudo (not recommended)
sudo npm start

# Or use port forwarding (recommended)
sudo iptables -t nat -A PREROUTING -p tcp --dport 23 -j REDIRECT --to-port 2323
```

## Security Recommendations

1. **Change Default Password:**
   - Login with the sysop account (username set via `BBS_SYSOP` in `.env`, default password: `sysop`)
   - Go to Settings → Change Password
   - Choose a strong password

2. **Firewall:**
   - Only open necessary ports
   - Consider using fail2ban for brute force protection

3. **Regular Backups:**
   ```bash
   # Backup database
   cp data/bbs.db data/bbs.db.backup.$(date +%Y%m%d)
   ```

4. **Update Dependencies:**
   ```bash
   npm update
   ```

## Additional Features

### Customizing ANSI Art

Edit `src/utils/screen.js` to customize the welcome screen ASCII art.

### Adding Custom Bulletins

Use the web interface or directly insert into the database:
```sql
INSERT INTO bulletins (title, content, author_id, author_name, security_level)
VALUES ('My Bulletin', 'Content here', 1, 'Sysop', 10);
```

### File Upload/Download via Web

File management via telnet is limited. Use the web interface for file operations.

## Support

For issues or questions:
- Check logs in `logs/` directory
- Review error messages in console
- Ensure all dependencies are installed

## Next Steps

1. Customize your BBS name in `.env`
2. Add custom bulletins
3. Set up DOOR games
4. Invite users!
5. Have fun reliving the BBS era!
