/**
 * Database Schema Definitions
 */

export const SCHEMA = {
  users: `
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      email TEXT UNIQUE,
      real_name TEXT,
      location TEXT,
      security_level INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_login DATETIME,
      login_count INTEGER DEFAULT 0,
      time_online INTEGER DEFAULT 0,
      uploads INTEGER DEFAULT 0,
      downloads INTEGER DEFAULT 0,
      posts INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      door_time_bank INTEGER DEFAULT 60
    )
  `,

  forums: `
    CREATE TABLE IF NOT EXISTS forums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      security_level INTEGER DEFAULT 10,
      post_count INTEGER DEFAULT 0,
      sort_order INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  messages: `
    CREATE TABLE IF NOT EXISTS messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      forum_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      reply_to INTEGER,
      network_id TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (reply_to) REFERENCES messages(id) ON DELETE SET NULL
    )
  `,

  private_messages: `
    CREATE TABLE IF NOT EXISTS private_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_user_id INTEGER NOT NULL,
      to_user_id INTEGER NOT NULL,
      subject TEXT NOT NULL,
      body TEXT NOT NULL,
      is_read INTEGER DEFAULT 0,
      is_deleted_by_sender INTEGER DEFAULT 0,
      is_deleted_by_receiver INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      read_at DATETIME,
      FOREIGN KEY (from_user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY (to_user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  file_areas: `
    CREATE TABLE IF NOT EXISTS file_areas (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      path TEXT NOT NULL,
      security_level INTEGER DEFAULT 10,
      allow_uploads INTEGER DEFAULT 0,
      file_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  files: `
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      area_id INTEGER NOT NULL,
      filename TEXT NOT NULL,
      original_name TEXT NOT NULL,
      description TEXT,
      uploader_id INTEGER NOT NULL,
      uploader_name TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      download_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (area_id) REFERENCES file_areas(id) ON DELETE CASCADE,
      FOREIGN KEY (uploader_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  doors: `
    CREATE TABLE IF NOT EXISTS doors (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      door_type TEXT DEFAULT 'local',
      command TEXT,
      working_dir TEXT,
      telnet_host TEXT,
      telnet_port INTEGER DEFAULT 2323,
      security_level INTEGER DEFAULT 10,
      enabled INTEGER DEFAULT 1,
      times_played INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  sessions: `
    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id INTEGER,
      username TEXT,
      ip_address TEXT,
      connected_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  system_logs: `
    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      log_type TEXT NOT NULL,
      user_id INTEGER,
      username TEXT,
      message TEXT NOT NULL,
      ip_address TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `,

  oneliners: `
    CREATE TABLE IF NOT EXISTS oneliners (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      message TEXT NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  bulletins: `
    CREATE TABLE IF NOT EXISTS bulletins (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      author_id INTEGER NOT NULL,
      author_name TEXT NOT NULL,
      security_level INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  polls: `
    CREATE TABLE IF NOT EXISTS polls (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      question TEXT NOT NULL,
      created_by INTEGER NOT NULL,
      created_by_name TEXT NOT NULL,
      security_level INTEGER DEFAULT 10,
      is_active INTEGER DEFAULT 1,
      allow_multiple INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME,
      FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  poll_options: `
    CREATE TABLE IF NOT EXISTS poll_options (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      option_text TEXT NOT NULL,
      sort_order INTEGER DEFAULT 0,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE
    )
  `,

  poll_votes: `
    CREATE TABLE IF NOT EXISTS poll_votes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      poll_id INTEGER NOT NULL,
      option_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      voted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (poll_id) REFERENCES polls(id) ON DELETE CASCADE,
      FOREIGN KEY (option_id) REFERENCES poll_options(id) ON DELETE CASCADE,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(poll_id, user_id)
    )
  `,

  banned_ips: `
    CREATE TABLE IF NOT EXISTS banned_ips (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL UNIQUE,
      reason TEXT,
      banned_by TEXT,
      banned_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  game_scores: `
    CREATE TABLE IF NOT EXISTS game_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_name TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      username TEXT NOT NULL,
      score INTEGER NOT NULL,
      details TEXT,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `,

  user_achievements: `
    CREATE TABLE IF NOT EXISTS user_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      achievement_id TEXT NOT NULL,
      earned_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
      UNIQUE(user_id, achievement_id)
    )
  `,

  scheduled_events: `
    CREATE TABLE IF NOT EXISTS scheduled_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      command TEXT NOT NULL,
      schedule_type TEXT NOT NULL,
      schedule_value TEXT NOT NULL,
      last_run DATETIME,
      next_run DATETIME,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // ─── Inter-BBS Networking ──────────────────────────────────────────────────

  bbs_links: `
    CREATE TABLE IF NOT EXISTS bbs_links (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      address TEXT NOT NULL,
      port INTEGER DEFAULT 3000,
      api_key TEXT NOT NULL,
      last_sync DATETIME,
      enabled INTEGER DEFAULT 1,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  networked_forums: `
    CREATE TABLE IF NOT EXISTS networked_forums (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      forum_id INTEGER NOT NULL,
      network_tag TEXT NOT NULL,
      FOREIGN KEY (forum_id) REFERENCES forums(id) ON DELETE CASCADE,
      UNIQUE(forum_id, network_tag)
    )
  `,

  sync_queue: `
    CREATE TABLE IF NOT EXISTS sync_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      target_link_id INTEGER NOT NULL,
      message_data TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      attempts INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (target_link_id) REFERENCES bbs_links(id) ON DELETE CASCADE
    )
  `,

  network_game_scores: `
    CREATE TABLE IF NOT EXISTS network_game_scores (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      game_name TEXT NOT NULL,
      username TEXT NOT NULL,
      origin_bbs TEXT NOT NULL,
      score INTEGER NOT NULL,
      played_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,

  // ─── RSS Feeds ─────────────────────────────────────────────────────────────

  rss_feeds: `
    CREATE TABLE IF NOT EXISTS rss_feeds (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      url TEXT NOT NULL UNIQUE,
      last_fetched DATETIME,
      enabled INTEGER DEFAULT 1,
      security_level INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    )
  `,
};

export const INDEXES = [
  'CREATE INDEX IF NOT EXISTS idx_messages_forum ON messages(forum_id)',
  'CREATE INDEX IF NOT EXISTS idx_messages_user ON messages(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_private_messages_to ON private_messages(to_user_id)',
  'CREATE INDEX IF NOT EXISTS idx_private_messages_from ON private_messages(from_user_id)',
  'CREATE INDEX IF NOT EXISTS idx_files_area ON files(area_id)',
  'CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_logs_user ON system_logs(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_logs_type ON system_logs(log_type)',
  'CREATE INDEX IF NOT EXISTS idx_oneliners_created ON oneliners(created_at)',
  'CREATE INDEX IF NOT EXISTS idx_poll_options_poll ON poll_options(poll_id)',
  'CREATE INDEX IF NOT EXISTS idx_poll_votes_poll_user ON poll_votes(poll_id, user_id)',
  'CREATE INDEX IF NOT EXISTS idx_banned_ips_address ON banned_ips(ip_address)',
  'CREATE INDEX IF NOT EXISTS idx_game_scores_game_score ON game_scores(game_name, score DESC)',
  'CREATE INDEX IF NOT EXISTS idx_game_scores_user ON game_scores(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_user_achievements_user ON user_achievements(user_id)',
  'CREATE INDEX IF NOT EXISTS idx_scheduled_events_enabled ON scheduled_events(enabled)',
  'CREATE INDEX IF NOT EXISTS idx_forums_sort_order ON forums(sort_order)',
  // Inter-BBS networking
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_status ON sync_queue(status)',
  'CREATE INDEX IF NOT EXISTS idx_sync_queue_target ON sync_queue(target_link_id)',
  'CREATE INDEX IF NOT EXISTS idx_networked_forums_forum ON networked_forums(forum_id)',
  'CREATE INDEX IF NOT EXISTS idx_networked_forums_tag ON networked_forums(network_tag)',
  'CREATE INDEX IF NOT EXISTS idx_messages_network_id ON messages(network_id)',
  'CREATE INDEX IF NOT EXISTS idx_network_game_scores_game ON network_game_scores(game_name, score DESC)',
  // RSS feeds
  'CREATE INDEX IF NOT EXISTS idx_rss_feeds_enabled ON rss_feeds(enabled)',
];

export const DEFAULT_DATA = {
  forums: [
    { name: 'General Discussion', description: 'General topics and announcements', security_level: 10 },
    { name: 'Technical Support', description: 'Help and support for BBS users', security_level: 10 },
    { name: 'File Discussions', description: 'Talk about uploaded files and software', security_level: 10 },
    { name: 'Sysop Area', description: 'Private area for system operators', security_level: 90 },
  ],

  file_areas: [
    { name: 'Uploads', description: 'User upload area — sysop reviews and moves files', path: 'uploads', security_level: 10, allow_uploads: 1 },
    { name: 'General Files', description: 'General file uploads', path: 'general', security_level: 10, allow_uploads: 0 },
    { name: 'Games', description: 'Game files and patches', path: 'games', security_level: 10, allow_uploads: 0 },
    { name: 'Documents', description: 'Text files and documentation', path: 'docs', security_level: 10, allow_uploads: 0 },
    { name: 'Software', description: 'Applications and utilities', path: 'software', security_level: 10, allow_uploads: 0 },
  ],

  bulletins: [
    {
      title: 'Welcome to the BBS!',
      content: `Welcome to this custom BBS system!

This bulletin board system has been designed to emulate the classic BBS experience from the 1990s, complete with ANSI graphics, door games, file areas, and message forums.

Available Features:
- Message Forums: Post and read messages in various topic areas
- Private Mail: Send private messages to other users
- File Areas: Upload and download files
- Door Games: Play classic BBS door games
- User Lists: See who else is on the system

Please be respectful of other users and follow the BBS rules.

Have fun!
- The Sysop`,
      author_id: 1,
      author_name: 'Sysop',
      security_level: 10,
    },
  ],

  doors: [
    {
      name: 'TradeWars 2002',
      description: 'TradeWars 2002 - Classic space trading and combat game. Build your empire, trade goods, and battle other players in the depths of space!',
      command: 'launch-tw-dosbox-x.bat',
      working_dir: 'doors/tw',
      security_level: 10,
      enabled: 1,
    },
  ],
};

export default SCHEMA;
