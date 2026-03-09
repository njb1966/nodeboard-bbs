# NodeBoard BBS - Project Dashboard

> **Priority:** P2 (Medium) | **Status:** 🔄 50% Complete | **Version:** 2.0.0-dev

## Overview

NodeBoard BBS is a fully functional, modern BBS (Bulletin Board System) built with Node.js. Inspired by classic 1990s systems (WWIV, Synchronet, Wildcat!) with modern features rivaling ENiGMA½ and Mystic BBS.

## Access Methods

| Protocol | Port | Command |
|----------|------|---------|
| **Telnet** | 2323 | `telnet localhost 2323` |
| **SSH** | 2222 | `ssh -p 2222 user@localhost` |
| **Web Terminal** | 3000 | `http://localhost:3000/terminal` |
| **Web Info** | 3000 | `http://localhost:3000` |

## Technology Stack

- **Runtime:** Node.js 18+ (ES Modules)
- **Database:** SQLite3 (better-sqlite3) — 23 tables
- **Telnet:** Node.js `net` module with IAC negotiation
- **SSH:** ssh2 package with RSA host key
- **Web:** Express + WebSocket + xterm.js terminal emulator
- **Auth:** bcrypt password hashing
- **UI:** ANSI/VT100 with CP437 support for retro telnet clients

## Implementation Progress

### Phase 1: Foundation & Polish — ✅ Complete
- [x] Shared text utilities (wordWrap extracted from services)
- [x] Config-driven menu system (JSON menu definitions)
- [x] ANSI art file loader with SAUCE metadata parsing
- [x] Unicode box-drawing characters with CP437 telnet conversion
- [x] Post-login sequence (system stats, last callers, mail/bulletin notifications)
- [x] Hybrid ANSI approach: section banners + improved menu formatting

### Phase 2: Communication & Community — ✅ Complete
- [x] Node-to-node private chat (paging with accept/decline)
- [x] Multi-user chat rooms (#lobby default, /who /topic /rooms commands)
- [x] OneLiners / Graffiti Wall
- [x] Enhanced Who's Online (node number, activity, time online)
- [x] Message quoting with `> ` prefix in replies
- [x] New message scan across all forums
- [x] Voting / Polls system with percentage bar results

### Phase 3: Security & Access — ✅ Complete
- [x] SSH server (port 2222, password auth, shared connection pool)
- [x] xterm.js web terminal (full BBS in browser)
- [x] Rate limiting (5 failures in 10min = 5min lockout)
- [x] IP ban list (persistent, sysop managed)
- [x] Max sessions per user (default 2)
- [x] Sysop kick user and IP ban management

### Phase 4: File System & Transfers — ✅ Complete
- [x] ZMODEM file transfers via lrzsz (sz/rz)
- [x] HTTP download tokens (single-use, 5min expiry)
- [x] FILE_ID.DIZ auto-extraction from ZIP uploads
- [x] New files scan since last login
- [x] Configurable download/upload ratios with sysop exemption

### Phase 5: Entertainment & Engagement — ✅ Complete
- [x] Built-in games: Trivia (31 questions), Hangman (51 words), Number Guesser
- [x] Game score persistence with top-10 leaderboards
- [x] 18 user achievements with auto-detection and progress tracking
- [x] Top callers and top posters in login sequence
- [x] Full DOOR32.SYS drop file generation (11 fields)
- [x] Door game time bank system (60min default)

### Phase 6: Sysop Tools & Administration — ✅ Complete
- [x] Full CRUD admin panel (users, forums, file areas, doors, bulletins)
- [x] Event scheduler (interval/daily/weekly, 5 built-in commands)
- [x] Theme/skin system (JSON theme files, applied to menu rendering)
- [x] Structured audit logging with type/user/date filters and text export

### Phase 7: Networking & Interoperability — ✅ Complete
- [x] Inter-BBS messaging (JSON sync via HTTP, API key auth, dedup)
- [x] Inter-BBS game score sharing
- [x] RSS feed reader with 15min cache

### Remaining Work — 📋 Planned (~50%)
- [ ] ANSI art screens for all menus (visual polish)
- [ ] Web-based sysop dashboard (real-time stats, user management)
- [ ] ActivityPub federation (BBS forums ↔ Fediverse)
- [ ] Full testing pass and bug fixes across all features
- [ ] Production hardening (error recovery, reconnection, edge cases)
- [ ] Documentation update (INSTALL.md, QUICKSTART.md, README.md)
- [ ] CP437 web font for xterm.js art rendering
- [ ] Improved ANSI art welcome/goodbye/section screens
- [ ] User-configurable terminal settings (width, encoding)
- [ ] Offline mail packets (QWK/modern equivalent)

## Project Structure

```
nodeboard-bbs/
├── src/
│   ├── config/              # Configuration + menu definitions (JSON)
│   │   └── menus/           # main.json, forums.json
│   ├── database/            # Schema (23 tables), init, migrations
│   ├── models/              # User, Session
│   ├── services/            # Business logic
│   │   ├── menus/           # MenuLoader, MenuEngine, MainMenu
│   │   ├── ForumService     # Message boards + quoting + new scan
│   │   ├── MessageService   # Private mail
│   │   ├── FileService      # File areas + ZMODEM + ratios
│   │   ├── DoorService      # DOOR games + DOOR32.SYS + time bank
│   │   ├── UserService      # User management + Who's Online
│   │   ├── SysopService     # Full CRUD admin panel
│   │   ├── ChatService      # Node-to-node + chat rooms
│   │   ├── ChatRoomManager  # Shared room state singleton
│   │   ├── GameService      # Trivia, Hangman, Number Guesser
│   │   ├── OneLinerService  # Graffiti wall
│   │   ├── PollService      # Voting/polls + edit
│   │   ├── AchievementService # 18 achievements
│   │   ├── LoginSequence    # Post-auth stats display
│   │   ├── RateLimiter      # Brute force protection
│   │   ├── LogService       # Structured audit logging
│   │   ├── EventScheduler   # Cron-like scheduled tasks
│   │   ├── ThemeService     # JSON theme/skin system
│   │   ├── NetworkService   # Inter-BBS sync
│   │   ├── RSSService       # RSS feed reader
│   │   └── DownloadTokenService # HTTP download tokens
│   ├── telnet/              # Telnet server + connection handler
│   ├── ssh/                 # SSH server (ssh2)
│   ├── utils/               # ANSI, screen, text, art loader
│   └── web/                 # Express + xterm.js terminal
├── art/                     # ANSI art files (.ans)
├── themes/                  # Theme JSON files
├── data/                    # Database, uploads, downloads, SSH key
├── doors/                   # DOOR game executables
└── logs/                    # System logs
```

## Database Schema (23 Tables)

| Table | Purpose |
|-------|---------|
| users | Accounts, profiles, stats, door_time_bank |
| forums | Message board categories with sort_order |
| messages | Forum posts with threading and network_id |
| private_messages | User-to-user mail |
| file_areas | File categories |
| files | File metadata and download tracking |
| doors | DOOR game configurations |
| sessions | Active user sessions |
| system_logs | Audit trail (typed, filterable) |
| bulletins | System announcements with expiry |
| oneliners | Graffiti wall messages |
| polls | Poll questions |
| poll_options | Poll answer choices |
| poll_votes | User votes (unique per poll) |
| banned_ips | IP ban list |
| game_scores | Built-in game leaderboards |
| user_achievements | Earned achievement tracking |
| scheduled_events | Event scheduler tasks |
| bbs_links | Inter-BBS linked systems |
| networked_forums | Forum ↔ network tag mapping |
| sync_queue | Outbound message sync queue |
| network_game_scores | Shared cross-BBS scores |
| rss_feeds | RSS feed subscriptions |

## Main Menu Keys

| Key | Feature | Key | Feature |
|-----|---------|-----|---------|
| M | Message Forums | O | OneLiners |
| N | New Message Scan | V | Voting Booth |
| P | Private Mail | E | Built-in Games |
| F | File Areas | R | RSS Feeds |
| Z | New File Scan | C | Chat/Page User |
| D | Door Games | S | User Settings |
| U | User List | A | Sysop Admin |
| W | Who's Online | G | Goodbye |
| B | Bulletins | | |

## Configuration (.env)

```
BBS_NAME              BBS display name
BBS_SYSOP             Sysop display name
BBS_PORT              Telnet port (default: 2323)
SSH_PORT              SSH port (default: 2222)
WEB_PORT              Web port (default: 3000)
DB_PATH               Database file path
UPLOAD_PATH           File upload directory
DOWNLOAD_PATH         File download directory
DOOR_PATH             DOOR games directory
SESSION_TIMEOUT       Idle timeout in ms (default: 1800000)
MAX_CONNECTIONS       Max simultaneous users (default: 50)
MAX_SESSIONS_PER_USER Max sessions per user (default: 2)
```

## Getting Started

1. Install Node.js 18+ (via nvm: `nvm install 20`)
2. `npm install`
3. `npm run init-db`
4. `npm start`
5. Connect: `telnet localhost 2323` or `http://localhost:3000/terminal`
6. Login: `sysop` / `sysop` (change password after first login)

## Credits

Built with inspiration from WWIV, Synchronet, Wildcat!, ENiGMA½, and Mystic BBS.

## License

MIT License
