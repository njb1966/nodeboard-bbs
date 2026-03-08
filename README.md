# NodeBoard BBS

A modern bulletin board system (BBS) inspired by classic 1990s systems like WWIV, Synchronet, and Wildcat.

## Features

- **Telnet Access**: Connect via telnet for an authentic BBS experience
- **ANSI Graphics**: Full ANSI/ASCII art support with classic BBS styling
- **Message Forums**: Public message boards with threaded discussions
- **Private Messaging**: Send and receive private messages between users
- **File Areas**: Upload and download files with descriptions
- **DOOR Games**: Run classic BBS door games (TradeWars, LoRD, etc.)
- **Web Interface**: Optional modern web frontend with ANSI-styled UI
- **Multi-user**: Support for multiple simultaneous connections

## Installation

```bash
# Install dependencies
npm install

# Copy environment configuration
cp .env.example .env

# Edit .env with your settings
nano .env

# Initialize database
npm run init-db

# Start the BBS
npm start
```

## Connecting

### Via Telnet
```bash
telnet localhost 2323
```

### Via Web Browser
```
http://localhost:3000
```

## System Requirements

- Node.js 18 or higher
- Ubuntu 20.04 (or similar Linux distribution)
- 512MB RAM minimum
- 1GB disk space

## DOOR Game Setup

Place DOOR game executables in the `./doors` directory. The BBS will detect and make them available in the DOOR menu.

## License

MIT
