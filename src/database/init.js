/**
 * Database Initialization
 */
import Database from 'better-sqlite3';
import { SCHEMA, INDEXES, DEFAULT_DATA } from './schema.js';
import config from '../config/index.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname, join } from 'path';
import bcrypt from 'bcrypt';

/**
 * Initialize database and create all tables
 */
export function initializeDatabase() {
  // Ensure data directory exists
  const dbDir = dirname(config.database.path);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  console.log(`Initializing database at: ${config.database.path}`);

  const db = new Database(config.database.path);

  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Create all tables
  console.log('Creating tables...');
  for (const [tableName, sql] of Object.entries(SCHEMA)) {
    console.log(`  - ${tableName}`);
    db.exec(sql);
  }

  // Create indexes
  console.log('Creating indexes...');
  for (const indexSql of INDEXES) {
    db.exec(indexSql);
  }

  // Insert default data if tables are empty
  console.log('Checking for default data...');

  // Insert default forums
  const forumCount = db.prepare('SELECT COUNT(*) as count FROM forums').get().count;
  if (forumCount === 0) {
    console.log('  - Inserting default forums');
    const insertForum = db.prepare('INSERT INTO forums (name, description, security_level) VALUES (?, ?, ?)');
    for (const forum of DEFAULT_DATA.forums) {
      insertForum.run(forum.name, forum.description, forum.security_level);
    }
  }

  // Insert default file areas
  const areaCount = db.prepare('SELECT COUNT(*) as count FROM file_areas').get().count;
  if (areaCount === 0) {
    console.log('  - Inserting default file areas');
    const insertArea = db.prepare('INSERT INTO file_areas (name, description, path, security_level) VALUES (?, ?, ?, ?)');
    for (const area of DEFAULT_DATA.file_areas) {
      insertArea.run(area.name, area.description, area.path, area.security_level);

      // Create directory for file area
      const areaPath = `${config.paths.downloads}/${area.path}`;
      if (!existsSync(areaPath)) {
        mkdirSync(areaPath, { recursive: true });
      }
    }
  }

  // Insert default doors
  const doorCount = db.prepare('SELECT COUNT(*) as count FROM doors').get().count;
  if (doorCount === 0 && DEFAULT_DATA.doors) {
    console.log('  - Inserting default door games');
    const insertDoor = db.prepare('INSERT INTO doors (name, description, command, working_dir, security_level, enabled) VALUES (?, ?, ?, ?, ?, ?)');
    for (const door of DEFAULT_DATA.doors) {
      const workingDir = door.working_dir.startsWith('/') || door.working_dir.match(/^[A-Za-z]:/)
        ? door.working_dir
        : join(config.paths.root, door.working_dir);
      insertDoor.run(door.name, door.description, door.command, workingDir, door.security_level, door.enabled);
    }
  }

  // Create default sysop user if no users exist
  const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
  if (userCount === 0) {
    console.log('  - Creating default sysop user');
    const hashedPassword = bcrypt.hashSync('sysop', config.security.bcryptRounds);
    db.prepare(`
      INSERT INTO users (username, password, email, real_name, security_level)
      VALUES (?, ?, ?, ?, ?)
    `).run('sysop', hashedPassword, 'sysop@localhost', 'System Operator', 99);

    // Insert welcome bulletin with sysop as author
    console.log('  - Inserting welcome bulletin');
    const insertBulletin = db.prepare('INSERT INTO bulletins (title, content, author_id, author_name, security_level) VALUES (?, ?, ?, ?, ?)');
    for (const bulletin of DEFAULT_DATA.bulletins) {
      insertBulletin.run(bulletin.title, bulletin.content, bulletin.author_id, bulletin.author_name, bulletin.security_level);
    }
  }

  // ── Schema migrations for existing databases ──────────────────────────────
  // Add door_time_bank column to users if it doesn't exist
  const userColumns = db.prepare("PRAGMA table_info(users)").all().map(c => c.name);
  if (!userColumns.includes('door_time_bank')) {
    console.log('  - Adding door_time_bank column to users');
    db.exec('ALTER TABLE users ADD COLUMN door_time_bank INTEGER DEFAULT 60');
  }

  console.log('Database initialization complete!');
  console.log('');
  console.log('Default sysop credentials:');
  console.log('  Username: sysop');
  console.log('  Password: sysop');
  console.log('  (Please change this password after first login!)');

  db.close();
  return true;
}

// Run if called directly
// Handle both Unix and Windows path formats
const isMainModule = import.meta.url.endsWith('init.js') && process.argv[1]?.includes('init.js');
if (isMainModule) {
  try {
    initializeDatabase();
  } catch (error) {
    console.error('Error initializing database:', error);
    process.exit(1);
  }
}

export default initializeDatabase;
