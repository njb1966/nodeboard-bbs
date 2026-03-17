# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

NodeBoard BBS is a Node.js bulletin board system (BBS) with multi-protocol access: Telnet (2323), SSH (2222), and Web browser via xterm.js (3000). It reimplements classic 1990s BBS features (forums, private mail, file transfers, DOOR games) with modern additions (inter-BBS networking, RSS feeds, achievements, chat rooms).

**Runtime**: Node.js 18+ | **Database**: SQLite3 (better-sqlite3) | **Modules**: ES modules (`"type": "module"`)

## Commands

```bash
npm install          # Install dependencies
npm run init-db      # Initialize/migrate SQLite database (run after schema changes)
npm start            # Start all servers (Telnet + SSH + Web)
npm run dev          # Dev mode with --watch (auto-restart on file changes)
```

**Connect for testing:**
- Telnet: `telnet localhost 2323`
- SSH: `ssh -p 2222 guest@localhost` (password: guest)
- Web terminal: `http://localhost:3000/terminal`

**Default sysop account**: username `sysop`, password `sysop` (change in `.env`)

No test suite or linter is configured yet.

## Architecture

### Entry Point & Protocol Handling

`src/index.js` starts three servers and an `EventScheduler`. All protocols converge on a shared **`TelnetConnection`** class (`src/telnet/connection.js`) that handles the entire BBS session:

- **Telnet**: `src/telnet/server.js` → allocates a node number, creates `TelnetConnection`
- **SSH**: `src/ssh/server.js` → authenticates via ssh2, then wraps in `TelnetConnection` with `protocol='ssh'`
- **Web**: `src/web/server.js` → Express serves xterm.js frontend; WebSocket messages are bridged to `WebTelnetConnection` (extends `TelnetConnection`, skips IAC telnet negotiation)

### Session Flow

1. Connect → node number allocated from pool
2. `TelnetConnection` handles IAC negotiation (Telnet only), login/registration
3. `LoginSequence.js` displays stats, new mail, achievements
4. `MainMenu.js` dispatches to services based on user input
5. Services return formatted ANSI output via `BBSScreen` utilities

### Key Abstractions

- **`BBSScreen`** (`src/utils/screen.js`): All screen output — menus, prompts, input, formatting. Every service calls this for output.
- **`ansi.js`** (`src/utils/ansi.js`): ANSI color codes, CP437 ↔ Unicode conversion for telnet clients
- **`MenuEngine.js`** / `MenuLoader.js` (`src/services/menus/`): Loads JSON menu definitions from `src/config/menus/`, renders them with ANSI formatting
- **`db.js`** (`src/database/db.js`): Singleton better-sqlite3 instance. All services import this directly — no ORM.

### Service Layer

`src/services/` contains one file per feature domain. Each service is a class with static methods that take a `connection` object and interact with the database directly via `db.js`. The `connection` object carries `user`, `node`, `send()`, and other session state.

Key services: `ForumService`, `MessageService`, `FileService`, `DoorService`, `ChatService`, `GameService`, `SysopService`, `AchievementService`, `NetworkService`, `RSSService`

### Database

Schema defined in `src/database/schema.js` (23 tables). `src/database/init.js` creates tables, inserts defaults, and runs any column migrations. **Re-run `npm run init-db` after schema changes** — it uses `IF NOT EXISTS` and `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` patterns, so it's safe to re-run.

### Configuration

`.env` → `src/config/index.js` → exported `config` object imported by all modules. Copy `.env.example` to `.env` before first run. Menu structure is JSON in `src/config/menus/`.

### ANSI/Terminal Rendering

The BBS renders to a fixed 80-column terminal. CP437 encoding is used for Telnet clients (classic ANSI art compatibility). Web and SSH clients use UTF-8. The `ansi.js` utility handles conversion. ANSI art files (`.ans`) live in `art/` and are loaded by `artloader.js`.

### DOOR Games

`DoorService.js` launches external DOOR game executables from `doors/`. It writes a `DOOR32.SYS` drop file before launch. TradeWars 2002 is the reference implementation (see `TRADEWARS-SETUP.md`).

### Inter-BBS Networking

`NetworkService.js` syncs forum messages between linked BBS nodes via HTTP with API key authentication. `network_id` on messages prevents duplicate imports. The `sync_queue` table manages outbound sync.
