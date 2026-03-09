/**
 * Structured Logging Service
 *
 * Centralised logging helper that writes to the system_logs table.
 * Log types: LOGIN, LOGOUT, LOGIN_FAILED, SIGNUP, SECURITY, ADMIN,
 *            SYSTEM, CHAT, FILE, ERROR
 */
import getDatabase from '../database/db.js';

/**
 * Write a structured log entry to the system_logs table.
 *
 * @param {string} type     - Log type (LOGIN, LOGOUT, LOGIN_FAILED, SIGNUP, SECURITY, ADMIN, SYSTEM, CHAT, FILE, ERROR)
 * @param {number|null} userId   - User ID (null for system events)
 * @param {string|null} username - Username (null for system events)
 * @param {string} message       - Human-readable description
 * @param {string|null} ipAddress - Remote IP address
 */
export function logEvent(type, userId, username, message, ipAddress = null) {
  try {
    const db = getDatabase();
    db.prepare(
      'INSERT INTO system_logs (log_type, user_id, username, message, ip_address) VALUES (?, ?, ?, ?, ?)'
    ).run(type, userId, username, message, ipAddress);
  } catch (_err) {
    // Logging should never crash the caller
    console.error('[LogService] Failed to write log:', _err.message);
  }
}

/**
 * Query log entries with optional filters.
 *
 * @param {object} opts
 * @param {string} [opts.type]     - Filter by log_type
 * @param {string} [opts.username] - Filter by username (case-insensitive)
 * @param {string} [opts.dateFrom] - ISO date string lower bound
 * @param {string} [opts.dateTo]   - ISO date string upper bound
 * @param {number} [opts.limit=20] - Page size
 * @param {number} [opts.offset=0] - Page offset
 * @returns {{ rows: Array, total: number }}
 */
export function queryLogs(opts = {}) {
  const db = getDatabase();
  const conditions = [];
  const params = [];

  if (opts.type) {
    conditions.push('log_type = ?');
    params.push(opts.type);
  }
  if (opts.username) {
    conditions.push('username LIKE ?');
    params.push(`%${opts.username}%`);
  }
  if (opts.dateFrom) {
    conditions.push('created_at >= ?');
    params.push(opts.dateFrom);
  }
  if (opts.dateTo) {
    conditions.push('created_at <= ?');
    params.push(opts.dateTo);
  }

  const where = conditions.length > 0 ? 'WHERE ' + conditions.join(' AND ') : '';
  const limit = opts.limit || 20;
  const offset = opts.offset || 0;

  const total = db.prepare(`SELECT COUNT(*) as count FROM system_logs ${where}`).get(...params).count;
  const rows = db.prepare(
    `SELECT * FROM system_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { rows, total };
}

export default { logEvent, queryLogs };
