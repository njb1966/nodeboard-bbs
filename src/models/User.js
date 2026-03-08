/**
 * User Model
 */
import bcrypt from 'bcrypt';
import getDatabase from '../database/db.js';
import config from '../config/index.js';

export class User {
  constructor(data) {
    Object.assign(this, data);
  }

  /**
   * Create a new user
   */
  static async create(username, password, email = null, realName = null) {
    const db = getDatabase();

    // Validate username
    if (username.length < 3 || username.length > 20) {
      throw new Error('Username must be between 3 and 20 characters');
    }

    if (!/^[a-zA-Z0-9_-]+$/.test(username)) {
      throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
    }

    // Validate password
    if (password.length < config.security.passwordMinLength) {
      throw new Error(`Password must be at least ${config.security.passwordMinLength} characters`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, config.security.bcryptRounds);

    try {
      const result = db.prepare(`
        INSERT INTO users (username, password, email, real_name)
        VALUES (?, ?, ?, ?)
      `).run(username, hashedPassword, email, realName);

      return User.findById(result.lastInsertRowid);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static findById(id) {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
    return user ? new User(user) : null;
  }

  /**
   * Find user by username
   */
  static findByUsername(username) {
    const db = getDatabase();
    const user = db.prepare('SELECT * FROM users WHERE username = ? COLLATE NOCASE').get(username);
    return user ? new User(user) : null;
  }

  /**
   * Verify password
   */
  async verifyPassword(password) {
    return await bcrypt.compare(password, this.password);
  }

  /**
   * Update last login
   */
  updateLastLogin() {
    const db = getDatabase();
    db.prepare(`
      UPDATE users
      SET last_login = CURRENT_TIMESTAMP, login_count = login_count + 1
      WHERE id = ?
    `).run(this.id);
  }

  /**
   * Update time online (in seconds)
   */
  updateTimeOnline(seconds) {
    const db = getDatabase();
    db.prepare(`
      UPDATE users
      SET time_online = time_online + ?
      WHERE id = ?
    `).run(seconds, this.id);
  }

  /**
   * Increment post count
   */
  incrementPosts() {
    const db = getDatabase();
    db.prepare('UPDATE users SET posts = posts + 1 WHERE id = ?').run(this.id);
  }

  /**
   * Increment upload count
   */
  incrementUploads() {
    const db = getDatabase();
    db.prepare('UPDATE users SET uploads = uploads + 1 WHERE id = ?').run(this.id);
  }

  /**
   * Increment download count
   */
  incrementDownloads() {
    const db = getDatabase();
    db.prepare('UPDATE users SET downloads = downloads + 1 WHERE id = ?').run(this.id);
  }

  /**
   * Get all users
   */
  static getAll(limit = 100, offset = 0) {
    const db = getDatabase();
    const users = db.prepare(`
      SELECT id, username, real_name, location, created_at, last_login, login_count, posts, uploads, downloads
      FROM users
      WHERE status = 'active'
      ORDER BY username
      LIMIT ? OFFSET ?
    `).all(limit, offset);

    return users.map(u => new User(u));
  }

  /**
   * Get user count
   */
  static getCount() {
    const db = getDatabase();
    return db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get().count;
  }

  /**
   * Update user profile
   */
  updateProfile(data) {
    const db = getDatabase();
    const allowed = ['email', 'real_name', 'location'];
    const updates = [];
    const values = [];

    for (const [key, value] of Object.entries(data)) {
      if (allowed.includes(key)) {
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }

    if (updates.length > 0) {
      values.push(this.id);
      db.prepare(`UPDATE users SET ${updates.join(', ')} WHERE id = ?`).run(...values);

      // Refresh user data
      const updated = User.findById(this.id);
      Object.assign(this, updated);
    }
  }

  /**
   * Change password
   */
  async changePassword(newPassword) {
    if (newPassword.length < config.security.passwordMinLength) {
      throw new Error(`Password must be at least ${config.security.passwordMinLength} characters`);
    }

    const hashedPassword = await bcrypt.hash(newPassword, config.security.bcryptRounds);
    const db = getDatabase();
    db.prepare('UPDATE users SET password = ? WHERE id = ?').run(hashedPassword, this.id);
  }

  /**
   * Check if user is sysop
   */
  isSysop() {
    return this.security_level >= 90;
  }

  /**
   * Get unread private message count
   */
  getUnreadMessageCount() {
    const db = getDatabase();
    return db.prepare(`
      SELECT COUNT(*) as count
      FROM private_messages
      WHERE to_user_id = ? AND is_read = 0 AND is_deleted_by_receiver = 0
    `).get(this.id).count;
  }

  /**
   * Convert to safe object (without password)
   */
  toJSON() {
    const { password, ...safe } = this;
    return safe;
  }
}

export default User;
