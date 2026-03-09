/**
 * Session Model
 */
import { v4 as uuidv4 } from 'uuid';
import getDatabase from '../database/db.js';
import config from '../config/index.js';

export class Session {
  constructor(data) {
    Object.assign(this, data);
  }

  /**
   * Create new session
   */
  static create(userId, username, ipAddress) {
    const db = getDatabase();
    const id = uuidv4();

    db.prepare(`
      INSERT INTO sessions (id, user_id, username, ip_address)
      VALUES (?, ?, ?, ?)
    `).run(id, userId, username, ipAddress);

    return Session.findById(id);
  }

  /**
   * Find session by ID
   */
  static findById(id) {
    const db = getDatabase();
    const session = db.prepare('SELECT * FROM sessions WHERE id = ?').get(id);
    return session ? new Session(session) : null;
  }

  /**
   * Update last activity
   */
  updateActivity() {
    const db = getDatabase();
    db.prepare(`
      UPDATE sessions
      SET last_activity = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(this.id);
  }

  /**
   * End session
   */
  end() {
    const db = getDatabase();
    db.prepare("UPDATE sessions SET status = 'ended' WHERE id = ?").run(this.id);
  }

  /**
   * Get active sessions for a specific user
   * @param {number} userId
   * @returns {Session[]}
   */
  static getByUserId(userId) {
    const db = getDatabase();
    const sessions = db.prepare(`
      SELECT * FROM sessions
      WHERE user_id = ? AND status = 'active'
      ORDER BY connected_at DESC
    `).all(userId);

    return sessions.map(s => new Session(s));
  }

  /**
   * Count active sessions for a specific user
   * @param {number} userId
   * @returns {number}
   */
  static getActiveByUserId(userId) {
    const db = getDatabase();
    return db.prepare(
      "SELECT COUNT(*) as count FROM sessions WHERE user_id = ? AND status = 'active'"
    ).get(userId).count;
  }

  /**
   * Forcefully end a session (for sysop kick)
   * @param {string} sessionId
   */
  static forceEnd(sessionId) {
    const db = getDatabase();
    db.prepare("UPDATE sessions SET status = 'ended' WHERE id = ?").run(sessionId);
  }

  /**
   * Get all active sessions
   */
  static getActive() {
    const db = getDatabase();
    const sessions = db.prepare(`
      SELECT s.*, u.real_name
      FROM sessions s
      LEFT JOIN users u ON s.user_id = u.id
      WHERE s.status = 'active'
      ORDER BY s.connected_at DESC
    `).all();

    return sessions.map(s => new Session(s));
  }

  /**
   * Get active session count
   */
  static getActiveCount() {
    const db = getDatabase();
    return db.prepare("SELECT COUNT(*) as count FROM sessions WHERE status = 'active'").get().count;
  }

  /**
   * Clean up old sessions
   */
  static cleanup() {
    const db = getDatabase();
    const timeout = config.session.timeout;
    const cutoff = new Date(Date.now() - timeout).toISOString();

    db.prepare(`
      UPDATE sessions
      SET status = 'timed_out'
      WHERE status = 'active' AND last_activity < ?
    `).run(cutoff);
  }

  /**
   * Get session duration in seconds
   */
  getDuration() {
    const start = new Date(this.connected_at);
    const end = new Date(this.last_activity);
    return Math.floor((end - start) / 1000);
  }
}

export default Session;
