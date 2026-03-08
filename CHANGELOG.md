# Changelog

All notable changes to NodeBoard BBS will be documented in this file.

## [1.1.0] - 2026-01-08

### Changed
- **Rebranded from "Custom BBS" to "NodeBoard BBS"**
- Updated all documentation and configuration files with new branding
- Version bumped to 1.1.0

### Added
- Word wrapping for forum messages, private messages, and bulletins for better readability
- Comprehensive Sysop Admin menu with the following features:
  - User Management - View all users and their details
  - Bulletin Management - Add and delete system bulletins
  - Forum Management - View forum statistics
  - File Area Management - View file area information
  - DOOR Management - View and manage DOOR games
  - System Statistics - View overall BBS statistics
  - System Logs - View recent system log entries
  - Active Sessions - See who's currently connected

### Fixed
- Welcome screen alignment issues in SyncTerm and other telnet clients
- Replaced all Unicode box characters with ASCII equivalents for terminal compatibility
- Fixed "Press ENTER to continue" in User Statistics (now waits for any key)
- Message body text now wraps properly at 78 characters width

### Improved
- Cleaner ANSI rendering throughout the BBS
- Better terminal compatibility across different clients
- More consistent box drawing and text alignment

## [1.0.0] - 2026-01-08

### Initial Release
- Telnet server with ANSI graphics support
- User registration and authentication system
- Public message forums with threaded discussions
- Private messaging between users
- File upload/download areas
- DOOR game support (TradeWars, LoRD, etc.)
- System bulletins
- Multi-user support (up to 50 simultaneous connections)
- Web interface with ANSI-styled UI
- SQLite database backend
- Session management
- User statistics and profiles
- Security levels and permissions
- Who's Online display
- User list functionality
