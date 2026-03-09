/**
 * Download Token Service
 *
 * Manages single-use, time-limited download tokens for HTTP file downloads.
 * Both FileService (token creation) and WebServer (token redemption) import
 * from this singleton to avoid circular dependencies.
 */
import { v4 as uuidv4 } from 'uuid';
import config from '../config/index.js';

/** @type {Map<string, { filePath: string, fileName: string, userId: number, expires: number }>} */
const tokens = new Map();

/** Token lifetime in milliseconds (5 minutes) */
const TOKEN_TTL = 5 * 60 * 1000;

/** Cleanup interval (runs every 60 seconds to prune expired tokens) */
const CLEANUP_INTERVAL = 60 * 1000;

// Periodic cleanup of expired tokens
setInterval(() => {
  const now = Date.now();
  for (const [token, data] of tokens) {
    if (data.expires <= now) {
      tokens.delete(token);
    }
  }
}, CLEANUP_INTERVAL).unref(); // .unref() so it doesn't keep the process alive

/**
 * Generate a single-use download token for a file.
 *
 * @param {string} filePath  - Absolute path to the file on disk
 * @param {string} fileName  - Original/display filename for Content-Disposition
 * @param {number} userId    - ID of the user requesting the download
 * @returns {string} Full download URL
 */
export function generateDownloadToken(filePath, fileName, userId) {
  const token = uuidv4();
  tokens.set(token, {
    filePath,
    fileName,
    userId,
    expires: Date.now() + TOKEN_TTL,
  });

  const host = process.env.WEB_HOST || 'localhost';
  const port = config.web.port;
  return `http://${host}:${port}/download/${token}`;
}

/**
 * Redeem (consume) a download token.
 * Returns the token data if valid, or null if expired / not found.
 * The token is deleted after redemption (single-use).
 *
 * @param {string} token
 * @returns {{ filePath: string, fileName: string, userId: number } | null}
 */
export function redeemDownloadToken(token) {
  const data = tokens.get(token);
  if (!data) return null;

  // Check expiry
  if (data.expires <= Date.now()) {
    tokens.delete(token);
    return null;
  }

  // Single-use: delete after redemption
  tokens.delete(token);
  return data;
}

export default { generateDownloadToken, redeemDownloadToken };
