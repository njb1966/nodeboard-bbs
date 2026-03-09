/**
 * Inter-BBS Network Service
 *
 * Modern JSON-based message sync between NodeBoard instances,
 * inspired by FidoNet echomail. Direct hub-and-spoke topology.
 */
import getDatabase from '../database/db.js';
import { colorText, padText } from '../utils/ansi.js';
import { logEvent } from './LogService.js';
import config from '../config/index.js';

// ─── Sync Engine ─────────────────────────────────────────────────────────────

/**
 * Queue a message for sync to all linked BBSes.
 * Called when a message is posted in a networked forum.
 *
 * @param {number} forumId
 * @param {object} message - The message row from the database
 */
export function queueMessageForSync(forumId, message) {
  const db = getDatabase();

  // Check if this forum is networked
  const netForum = db.prepare(
    'SELECT network_tag FROM networked_forums WHERE forum_id = ?'
  ).get(forumId);

  if (!netForum) return;

  // Don't re-sync messages that came from the network
  if (message.network_id) return;

  // Build the network message payload
  const bbsName = config.bbs.name;
  const payload = JSON.stringify({
    network_tag: netForum.network_tag,
    origin_bbs: bbsName,
    origin_id: `${bbsName}:msg:${message.id}`,
    author: `${message.username}@${bbsName}`,
    subject: message.subject,
    body: message.body,
    posted_at: message.created_at || new Date().toISOString(),
    reply_to_network_id: null,
  });

  // Queue for all enabled linked BBSes
  const links = db.prepare(
    'SELECT id FROM bbs_links WHERE enabled = 1'
  ).all();

  const insertQueue = db.prepare(
    'INSERT INTO sync_queue (target_link_id, message_data) VALUES (?, ?)'
  );

  for (const link of links) {
    insertQueue.run(link.id, payload);
  }

  if (links.length > 0) {
    logEvent('NETWORK', null, null, `Queued message "${message.subject}" for sync to ${links.length} linked BBS(es)`);
  }
}

/**
 * Queue a game score for sync to all linked BBSes.
 *
 * @param {string} gameName
 * @param {string} username
 * @param {number} score
 */
export function queueScoreForSync(gameName, username, score) {
  const db = getDatabase();

  const links = db.prepare(
    'SELECT id FROM bbs_links WHERE enabled = 1'
  ).all();

  if (links.length === 0) return;

  const bbsName = config.bbs.name;
  const payload = JSON.stringify({
    type: 'game_score',
    origin_bbs: bbsName,
    game_name: gameName,
    username: `${username}@${bbsName}`,
    score,
    played_at: new Date().toISOString(),
  });

  const insertQueue = db.prepare(
    'INSERT INTO sync_queue (target_link_id, message_data) VALUES (?, ?)'
  );

  for (const link of links) {
    insertQueue.run(link.id, payload);
  }
}

/**
 * Process the sync queue — send pending messages to linked BBSes.
 * Called periodically by the EventScheduler.
 */
export async function processSyncQueue() {
  const db = getDatabase();

  const pending = db.prepare(`
    SELECT sq.*, bl.address, bl.port, bl.api_key, bl.name as link_name
    FROM sync_queue sq
    JOIN bbs_links bl ON sq.target_link_id = bl.id
    WHERE sq.status = 'pending' AND sq.attempts < 3 AND bl.enabled = 1
    ORDER BY sq.created_at
    LIMIT 50
  `).all();

  if (pending.length === 0) return 'No pending items in sync queue';

  let sent = 0;
  let failed = 0;

  for (const item of pending) {
    try {
      const url = `http://${item.address}:${item.port}/api/sync/receive`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': item.api_key,
        },
        body: item.message_data,
        signal: AbortSignal.timeout(10000),
      });

      if (response.ok) {
        db.prepare("UPDATE sync_queue SET status = 'sent' WHERE id = ?").run(item.id);
        sent++;
      } else {
        db.prepare(
          "UPDATE sync_queue SET attempts = attempts + 1, status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END WHERE id = ?"
        ).run(item.id);
        failed++;
      }
    } catch (err) {
      db.prepare(
        "UPDATE sync_queue SET attempts = attempts + 1, status = CASE WHEN attempts + 1 >= 3 THEN 'failed' ELSE 'pending' END WHERE id = ?"
      ).run(item.id);
      failed++;
    }
  }

  // Update last_sync on links that had successful sends
  if (sent > 0) {
    const linkIds = [...new Set(pending.filter((_, i) => i < sent).map(p => p.target_link_id))];
    for (const linkId of linkIds) {
      db.prepare("UPDATE bbs_links SET last_sync = datetime('now') WHERE id = ?").run(linkId);
    }
  }

  const result = `Sync queue processed: ${sent} sent, ${failed} failed`;
  logEvent('NETWORK', null, null, result);
  return result;
}

/**
 * Receive a message from a linked BBS.
 * Validates API key, inserts into the appropriate networked forum.
 *
 * @param {string} apiKey - The API key from the request
 * @param {object} messageData - The parsed message payload
 * @returns {{ success: boolean, error?: string }}
 */
export function receiveMessage(apiKey, messageData) {
  const db = getDatabase();

  // Validate API key
  const link = db.prepare(
    'SELECT * FROM bbs_links WHERE api_key = ? AND enabled = 1'
  ).get(apiKey);

  if (!link) {
    return { success: false, error: 'Invalid or disabled API key' };
  }

  // Handle game scores
  if (messageData.type === 'game_score') {
    return receiveGameScore(db, messageData);
  }

  // Find the local forum mapped to this network_tag
  const netForum = db.prepare(`
    SELECT nf.forum_id, f.name as forum_name
    FROM networked_forums nf
    JOIN forums f ON nf.forum_id = f.id
    WHERE nf.network_tag = ?
  `).get(messageData.network_tag);

  if (!netForum) {
    return { success: false, error: `No local forum mapped to network tag "${messageData.network_tag}"` };
  }

  // Check for duplicates by network_id
  const networkId = messageData.origin_id;
  const existing = db.prepare(
    'SELECT id FROM messages WHERE network_id = ?'
  ).get(networkId);

  if (existing) {
    return { success: true, message: 'Duplicate message, already received' };
  }

  // Insert the message
  db.prepare(`
    INSERT INTO messages (forum_id, user_id, username, subject, body, network_id, created_at)
    VALUES (?, 0, ?, ?, ?, ?, ?)
  `).run(
    netForum.forum_id,
    messageData.author,
    messageData.subject,
    messageData.body,
    networkId,
    messageData.posted_at || new Date().toISOString()
  );

  // Update forum post count
  db.prepare('UPDATE forums SET post_count = post_count + 1 WHERE id = ?').run(netForum.forum_id);

  logEvent('NETWORK', null, null, `Received message "${messageData.subject}" from ${messageData.origin_bbs} in ${netForum.forum_name}`);

  return { success: true };
}

/**
 * Receive a game score from a linked BBS.
 */
function receiveGameScore(db, scoreData) {
  // Check for duplicate (same origin_bbs + username + game + score + time)
  const existing = db.prepare(`
    SELECT id FROM network_game_scores
    WHERE origin_bbs = ? AND username = ? AND game_name = ? AND score = ? AND played_at = ?
  `).get(scoreData.origin_bbs, scoreData.username, scoreData.game_name, scoreData.score, scoreData.played_at);

  if (existing) {
    return { success: true, message: 'Duplicate score, already received' };
  }

  db.prepare(`
    INSERT INTO network_game_scores (game_name, username, origin_bbs, score, played_at)
    VALUES (?, ?, ?, ?, ?)
  `).run(scoreData.game_name, scoreData.username, scoreData.origin_bbs, scoreData.score, scoreData.played_at);

  logEvent('NETWORK', null, null, `Received game score: ${scoreData.username} scored ${scoreData.score} in ${scoreData.game_name} (from ${scoreData.origin_bbs})`);

  return { success: true };
}

/**
 * Get sync queue statistics.
 */
export function getSyncQueueStats() {
  const db = getDatabase();
  const stats = db.prepare(`
    SELECT status, COUNT(*) as count
    FROM sync_queue
    GROUP BY status
  `).all();

  const result = { pending: 0, sent: 0, failed: 0 };
  for (const row of stats) {
    result[row.status] = row.count;
  }
  return result;
}

/**
 * Check if inter-BBS networking is configured (any enabled links exist).
 */
export function isNetworkConfigured() {
  const db = getDatabase();
  const count = db.prepare('SELECT COUNT(*) as c FROM bbs_links WHERE enabled = 1').get().c;
  return count > 0;
}

/**
 * Get network game scores for a given game.
 */
export function getNetworkScores(gameName, limit = 10) {
  const db = getDatabase();
  return db.prepare(`
    SELECT username, origin_bbs, score, played_at
    FROM network_game_scores
    WHERE game_name = ?
    ORDER BY score DESC
    LIMIT ?
  `).all(gameName, limit);
}

export default {
  queueMessageForSync,
  queueScoreForSync,
  processSyncQueue,
  receiveMessage,
  getSyncQueueStats,
  isNetworkConfigured,
  getNetworkScores,
};
