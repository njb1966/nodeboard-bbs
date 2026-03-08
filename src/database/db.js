/**
 * Database Connection and Access Layer
 */
import Database from 'better-sqlite3';
import config from '../config/index.js';

let db = null;

/**
 * Get database connection (singleton)
 */
export function getDatabase() {
  if (!db) {
    db = new Database(config.database.path);
    db.pragma('foreign_keys = ON');
  }
  return db;
}

/**
 * Close database connection
 */
export function closeDatabase() {
  if (db) {
    db.close();
    db = null;
  }
}

export default getDatabase;
