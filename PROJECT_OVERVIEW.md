# NodeBoard BBS - Project Overview

## What You Have

A fully functional, modern BBS (Bulletin Board System) inspired by classic 1990s BBS systems, built with Node.js.

## Architecture

### Technology Stack
- **Backend:** Node.js with ES Modules
- **Database:** SQLite3 (better-sqlite3)
- **Telnet Server:** Node.js `net` module
- **Web Server:** Express + WebSocket
- **Authentication:** bcrypt password hashing
- **UI:** Full ANSI/VT100 terminal graphics

### Project Structure

```
custombbs/
├── src/
│   ├── config/           # Configuration management
│   ├── database/         # Database schema and initialization
│   ├── models/           # Data models (User, Session)
│   ├── services/         # Business logic
│   │   ├── menus/       # Menu systems
│   │   ├── ForumService.js
│   │   ├── MessageService.js
│   │   ├── FileService.js
│   │   ├── DoorService.js
│   │   └── UserService.js
│   ├── telnet/          # Telnet server and connection handling
│   ├── utils/           # ANSI rendering and screen utilities
│   ├── web/             # Web server and frontend
│   └── index.js         # Main entry point
├── data/                # Database and user files
├── doors/               # DOOR game executables
├── logs/                # System logs
└── [config files]
```

## Features Implemented

### ✅ Core BBS Features
- [x] Telnet server with ANSI graphics
- [x] User registration and authentication
- [x] Session management
- [x] Multi-user support (up to 50 simultaneous connections)

### ✅ Communication
- [x] Public message forums with threaded discussions
- [x] Private messaging system
- [x] Real-time "Who's Online" display
- [x] System bulletins

### ✅ File System
- [x] Multiple file areas with categories
- [x] File upload/download support
- [x] File descriptions and metadata
- [x] Download tracking

### ✅ Entertainment
- [x] DOOR game launcher
- [x] External process I/O bridging
- [x] Game play tracking

### ✅ User Management
- [x] User profiles with statistics
- [x] Security levels (1-99, with 90+ as sysop)
- [x] Login tracking
- [x] Time online tracking
- [x] Post/upload/download counters

### ✅ Administration
- [x] Sysop security levels
- [x] Configurable settings via .env
- [x] Database-driven content
- [x] Session management and timeouts

### ✅ Web Interface
- [x] Modern web frontend with ANSI-styled UI
- [x] CRT monitor effect
- [x] Responsive design
- [x] WebSocket support for future features

## Database Schema

### Tables Created
- **users** - User accounts and profiles
- **forums** - Message board categories
- **messages** - Forum posts (with threading)
- **private_messages** - User-to-user messages
- **file_areas** - File categories
- **files** - Uploaded files metadata
- **doors** - DOOR game configurations
- **sessions** - Active user sessions
- **system_logs** - System activity logs
- **bulletins** - System announcements

## Default Setup

### Default Accounts
- **Sysop:** username `sysop`, password `sysop` (security level 99)

### Default Forums
1. General Discussion
2. Technical Support
3. File Discussions
4. Sysop Area (restricted)

### Default File Areas
1. General Files
2. Games
3. Documents
4. Software

## Key Components

### ANSI Rendering Engine (`src/utils/ansi.js`)
- Full ANSI/VT100 color support
- Box drawing characters
- Cursor positioning
- Screen manipulation
- CP437 character set support

### Screen Management (`src/utils/screen.js`)
- Virtual screen buffer
- Menu rendering
- Message boxes
- ASCII art display
- BBS-style UI components

### Telnet Server (`src/telnet/server.js`)
- Connection handling
- Max connection limits
- Session cleanup
- Broadcast messaging

### Connection Handler (`src/telnet/connection.js`)
- Telnet negotiation
- Input buffering
- Character/line mode input
- User authentication
- Menu navigation

### Service Layer
Each service handles specific BBS functionality:
- **ForumService** - Message boards
- **MessageService** - Private mail
- **FileService** - File areas
- **DoorService** - DOOR games
- **UserService** - User management

## Configuration

### Environment Variables (.env)
```
BBS_NAME          - Your BBS name
BBS_SYSOP         - Sysop name
BBS_PORT          - Telnet port (default: 2323)
WEB_PORT          - Web port (default: 3000)
DB_PATH           - Database location
UPLOAD_PATH       - File upload directory
DOWNLOAD_PATH     - File download directory
DOOR_PATH         - DOOR games directory
SESSION_TIMEOUT   - Session timeout in ms
MAX_CONNECTIONS   - Max simultaneous users
```

## Getting Started

### Windows
1. Install Node.js from https://nodejs.org/
2. Run `setup.bat` to install and initialize
3. Run `start.bat` or `npm start` to start the BBS
4. Connect via `telnet localhost 2323`

### Ubuntu 20.04
1. Install Node.js: `curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash - && sudo apt-get install -y nodejs`
2. Run `npm install && npm run init-db`
3. Run `npm start`
4. Connect via `telnet localhost 2323`

## Usage

### Connecting
**Telnet:** `telnet localhost 2323`
**Web:** `http://localhost:3000`

### Navigation
- Type letter commands (e.g., `M` for Messages)
- Press Enter to submit
- Type `Q` to quit/go back

### Main Menu Options
- **M** - Message Forums
- **P** - Private Mail
- **F** - File Areas
- **D** - Door Games
- **U** - User List
- **W** - Who's Online
- **B** - Bulletins
- **S** - User Settings
- **A** - Sysop Admin (sysops only)
- **G** - Goodbye (logoff)

## Extending the BBS

### Adding DOOR Games
1. Place executable in `./doors/gamename/`
2. Add to database:
```sql
INSERT INTO doors (name, description, command, working_dir, security_level)
VALUES ('Game Name', 'Description', './executable', './doors/gamename', 10);
```

### Adding Forums
```sql
INSERT INTO forums (name, description, security_level)
VALUES ('New Forum', 'Description', 10);
```

### Adding File Areas
```sql
INSERT INTO file_areas (name, description, path, security_level)
VALUES ('New Area', 'Description', 'subfolder', 10);
```

### Adding Bulletins
```sql
INSERT INTO bulletins (title, content, author_id, author_name, security_level)
VALUES ('Title', 'Content', 1, 'Sysop', 10);
```

## Security Features

- **Password Hashing:** bcrypt with configurable rounds
- **Security Levels:** 1-99 (10=user, 90+=sysop)
- **Login Limits:** Configurable max attempts
- **Session Timeout:** Automatic idle disconnect
- **SQL Injection Protection:** Prepared statements
- **Input Validation:** Username and password rules

## Performance

- **Concurrent Users:** Up to 50 (configurable)
- **Database:** SQLite with indexes for performance
- **Session Cleanup:** Automatic every 60 seconds
- **Memory Efficient:** Streaming I/O for files and doors

## Future Enhancements

Potential additions you could implement:
- [ ] Full web-based terminal emulator
- [ ] Real-time chat system
- [ ] File transfer protocols (XMODEM, YMODEM, ZMODEM)
- [ ] Email gateway integration
- [ ] RSS feed reader
- [ ] Online game system
- [ ] BBS networking (FidoNet-style)
- [ ] ANSI art editor
- [ ] User statistics graphs
- [ ] Advanced sysop admin panel

## Technical Notes

### Character Encoding
- Terminal: UTF-8 with CP437 character mapping
- Database: UTF-8
- ANSI codes: Standard VT100/ANSI X3.64

### Telnet Protocol
- IAC command filtering
- Terminal type negotiation
- Echo and line mode support
- Binary mode for file transfers

### DOOR Game Support
- DOOR32.SYS drop file format (basic)
- Process I/O piping
- Environment variables (BBSUSER, BBSUID)
- Working directory management

## Credits

This BBS system was built with inspiration from:
- **WWIV** - Classic DOS-based BBS
- **Synchronet** - Modern multi-platform BBS
- **Wildcat!** - Popular 1990s BBS software

## License

MIT License - Feel free to modify and distribute!

## Support

For issues:
1. Check `QUICKSTART.md` for common problems
2. Review `INSTALL.md` for detailed setup
3. Check console logs for errors
4. Verify Node.js version (18+)

Enjoy your BBS!
