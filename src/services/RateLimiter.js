/**
 * Rate Limiter & Brute Force Protection
 *
 * Module-level singleton — shared across all connections.
 * In-memory tracking for login attempts with IP lockout.
 * Persistent IP ban list stored in database.
 */
import getDatabase from '../database/db.js';

// Track login attempts by IP address
const loginAttempts = new Map(); // ip -> { count, firstAttempt, lockedUntil }

// Configuration
const MAX_ATTEMPTS = 5;         // max failed attempts before lockout
const LOCKOUT_DURATION = 300000; // 5 minutes in ms
const ATTEMPT_WINDOW = 600000;  // 10 minute window for counting attempts

/**
 * Record a failed login attempt for an IP address.
 * If the attempt count reaches MAX_ATTEMPTS, the IP is locked out.
 * @param {string} ip
 */
export function recordFailedLogin(ip) {
  const now = Date.now();
  let entry = loginAttempts.get(ip);

  if (!entry || (now - entry.firstAttempt > ATTEMPT_WINDOW)) {
    // Start a new tracking window
    entry = { count: 1, firstAttempt: now, lockedUntil: null };
  } else {
    entry.count++;
  }

  if (entry.count >= MAX_ATTEMPTS) {
    entry.lockedUntil = now + LOCKOUT_DURATION;
  }

  loginAttempts.set(ip, entry);
}

/**
 * Record a successful login — clears attempt tracking for this IP.
 * @param {string} ip
 */
export function recordSuccessfulLogin(ip) {
  loginAttempts.delete(ip);
}

/**
 * Check whether an IP is currently locked out.
 * Also cleans up expired entries.
 * @param {string} ip
 * @returns {boolean}
 */
export function isLocked(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || !entry.lockedUntil) return false;

  const now = Date.now();

  if (now >= entry.lockedUntil) {
    // Lockout expired — clean up
    loginAttempts.delete(ip);
    return false;
  }

  return true;
}

/**
 * Get remaining lockout time in seconds.
 * @param {string} ip
 * @returns {number} seconds remaining, or 0 if not locked
 */
export function getRemainingLockout(ip) {
  const entry = loginAttempts.get(ip);
  if (!entry || !entry.lockedUntil) return 0;

  const remaining = entry.lockedUntil - Date.now();
  return remaining > 0 ? Math.ceil(remaining / 1000) : 0;
}

// ---------------------------------------------------------------------------
// Persistent IP ban list (stored in banned_ips table)
// ---------------------------------------------------------------------------

/**
 * Ban an IP address.
 * @param {string} ip
 * @param {string} [reason]
 * @param {string} [bannedBy]
 */
export function banIP(ip, reason = null, bannedBy = null) {
  const db = getDatabase();
  db.prepare(`
    INSERT OR REPLACE INTO banned_ips (ip_address, reason, banned_by)
    VALUES (?, ?, ?)
  `).run(ip, reason, bannedBy);
}

/**
 * Remove an IP ban.
 * @param {string} ip
 */
export function unbanIP(ip) {
  const db = getDatabase();
  db.prepare('DELETE FROM banned_ips WHERE ip_address = ?').run(ip);
}

/**
 * Check whether an IP is banned.
 * @param {string} ip
 * @returns {boolean}
 */
export function isBanned(ip) {
  const db = getDatabase();
  const row = db.prepare('SELECT 1 FROM banned_ips WHERE ip_address = ?').get(ip);
  return !!row;
}

/**
 * Return all banned IPs.
 * @returns {Array<{id: number, ip_address: string, reason: string|null, banned_by: string|null, banned_at: string}>}
 */
export function getBannedIPs() {
  const db = getDatabase();
  return db.prepare('SELECT * FROM banned_ips ORDER BY banned_at DESC').all();
}
