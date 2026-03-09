/**
 * Achievement/Badge Service
 *
 * Tracks user achievements and awards badges based on activity milestones.
 */
import getDatabase from '../database/db.js';
import { colorText, BOX } from '../utils/ansi.js';

/**
 * Achievement definitions.
 * Icons use ANSI-safe text symbols instead of emoji for terminal compatibility.
 */
const ACHIEVEMENTS = [
  { id: 'first_login',    name: 'Welcome Aboard',    desc: 'Log in for the first time',        icon: '*', iconColor: 'yellow' },
  { id: 'login_10',       name: 'Regular',            desc: 'Log in 10 times',                  icon: '*', iconColor: 'yellow' },
  { id: 'login_50',       name: 'Dedicated',          desc: 'Log in 50 times',                  icon: '*', iconColor: 'cyan' },
  { id: 'login_100',      name: 'Veteran',            desc: 'Log in 100 times',                 icon: '#', iconColor: 'yellow' },
  { id: 'first_post',     name: 'First Words',        desc: 'Make your first forum post',       icon: '+', iconColor: 'green' },
  { id: 'posts_10',       name: 'Conversationalist',  desc: 'Make 10 forum posts',              icon: '+', iconColor: 'green' },
  { id: 'posts_50',       name: 'Forum Regular',      desc: 'Make 50 forum posts',              icon: '+', iconColor: 'cyan' },
  { id: 'posts_100',      name: 'Prolific Poster',    desc: 'Make 100 forum posts',             icon: '!', iconColor: 'magenta' },
  { id: 'first_upload',   name: 'Contributor',        desc: 'Upload your first file',           icon: '^', iconColor: 'green' },
  { id: 'uploads_10',     name: 'Generous',           desc: 'Upload 10 files',                  icon: '^', iconColor: 'cyan' },
  { id: 'first_download', name: 'Collector',          desc: 'Download your first file',         icon: 'v', iconColor: 'green' },
  { id: 'first_door',     name: 'Gamer',              desc: 'Play your first door game',        icon: '>', iconColor: 'green' },
  { id: 'first_oneliner', name: 'Graffiti Artist',    desc: 'Write your first one-liner',       icon: '~', iconColor: 'green' },
  { id: 'first_vote',     name: 'Democratic',         desc: 'Vote in your first poll',          icon: 'x', iconColor: 'green' },
  { id: 'first_chat',     name: 'Social Butterfly',   desc: 'Chat with another user',           icon: '@', iconColor: 'cyan' },
  { id: 'time_1hr',       name: 'Time Flies',         desc: 'Spend 1 hour online total',        icon: '=', iconColor: 'yellow' },
  { id: 'time_24hr',      name: 'Day Tripper',        desc: 'Spend 24 hours online total',      icon: '=', iconColor: 'magenta' },
  { id: 'sysop',          name: 'The Boss',            desc: 'Achieve sysop status',             icon: '#', iconColor: 'red' },
];

/**
 * Map of achievement IDs to their threshold criteria for milestone-based achievements.
 * Used to show progress bars in the display.
 */
const MILESTONE_MAP = {
  first_login:    { stat: 'login_count',  threshold: 1 },
  login_10:       { stat: 'login_count',  threshold: 10 },
  login_50:       { stat: 'login_count',  threshold: 50 },
  login_100:      { stat: 'login_count',  threshold: 100 },
  first_post:     { stat: 'posts',        threshold: 1 },
  posts_10:       { stat: 'posts',        threshold: 10 },
  posts_50:       { stat: 'posts',        threshold: 50 },
  posts_100:      { stat: 'posts',        threshold: 100 },
  first_upload:   { stat: 'uploads',      threshold: 1 },
  uploads_10:     { stat: 'uploads',      threshold: 10 },
  first_download: { stat: 'downloads',    threshold: 1 },
  time_1hr:       { stat: 'time_online',  threshold: 3600 },
  time_24hr:      { stat: 'time_online',  threshold: 86400 },
};

export class AchievementService {
  /**
   * Check all achievements for a user and award any newly earned ones.
   * @param {object} user - User model instance (with fresh stats from DB)
   * @returns {object[]} Array of newly earned achievement definitions
   */
  static checkAndAward(user) {
    const db = getDatabase();

    // Refresh user stats from DB to get the latest counts
    const stats = db.prepare(
      'SELECT login_count, posts, uploads, downloads, time_online, security_level FROM users WHERE id = ?'
    ).get(user.id);

    if (!stats) return [];

    // Get already-earned achievement IDs
    const earned = new Set(
      db.prepare('SELECT achievement_id FROM user_achievements WHERE user_id = ?')
        .all(user.id)
        .map(r => r.achievement_id)
    );

    // Determine which achievements the user qualifies for
    const qualifies = [];

    // Login milestones
    if (stats.login_count >= 1)   qualifies.push('first_login');
    if (stats.login_count >= 10)  qualifies.push('login_10');
    if (stats.login_count >= 50)  qualifies.push('login_50');
    if (stats.login_count >= 100) qualifies.push('login_100');

    // Post milestones
    if (stats.posts >= 1)   qualifies.push('first_post');
    if (stats.posts >= 10)  qualifies.push('posts_10');
    if (stats.posts >= 50)  qualifies.push('posts_50');
    if (stats.posts >= 100) qualifies.push('posts_100');

    // Upload milestones
    if (stats.uploads >= 1)  qualifies.push('first_upload');
    if (stats.uploads >= 10) qualifies.push('uploads_10');

    // Download milestones
    if (stats.downloads >= 1) qualifies.push('first_download');

    // Time milestones
    if (stats.time_online >= 3600)  qualifies.push('time_1hr');
    if (stats.time_online >= 86400) qualifies.push('time_24hr');

    // Sysop
    if (stats.security_level >= 90) qualifies.push('sysop');

    // Door game (check game_scores table)
    const hasPlayed = db.prepare(
      'SELECT 1 FROM game_scores WHERE user_id = ? LIMIT 1'
    ).get(user.id);
    if (hasPlayed) qualifies.push('first_door');

    // Oneliner (check oneliners table)
    const hasOneliner = db.prepare(
      'SELECT 1 FROM oneliners WHERE user_id = ? LIMIT 1'
    ).get(user.id);
    if (hasOneliner) qualifies.push('first_oneliner');

    // Poll vote (check poll_votes table)
    const hasVoted = db.prepare(
      'SELECT 1 FROM poll_votes WHERE user_id = ? LIMIT 1'
    ).get(user.id);
    if (hasVoted) qualifies.push('first_vote');

    // Chat (check private_messages as proxy for chat activity)
    const hasChatted = db.prepare(
      'SELECT 1 FROM private_messages WHERE from_user_id = ? LIMIT 1'
    ).get(user.id);
    if (hasChatted) qualifies.push('first_chat');

    // Award new achievements
    const newlyEarned = [];
    const insertStmt = db.prepare(
      'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
    );

    for (const achId of qualifies) {
      if (!earned.has(achId)) {
        const result = insertStmt.run(user.id, achId);
        if (result.changes > 0) {
          const achDef = ACHIEVEMENTS.find(a => a.id === achId);
          if (achDef) newlyEarned.push(achDef);
        }
      }
    }

    return newlyEarned;
  }

  /**
   * Award a specific achievement by ID (for event-driven checks).
   * @param {object} user
   * @param {string} achievementId
   * @returns {object|null} The achievement definition if newly earned, null otherwise
   */
  static awardSingle(user, achievementId) {
    const db = getDatabase();
    const result = db.prepare(
      'INSERT OR IGNORE INTO user_achievements (user_id, achievement_id) VALUES (?, ?)'
    ).run(user.id, achievementId);

    if (result.changes > 0) {
      return ACHIEVEMENTS.find(a => a.id === achievementId) || null;
    }
    return null;
  }

  /**
   * Get all earned achievements for a user.
   * @param {number} userId
   * @returns {object[]} Array of { achievement_id, earned_at }
   */
  static getUserAchievements(userId) {
    const db = getDatabase();
    return db.prepare(
      'SELECT achievement_id, earned_at FROM user_achievements WHERE user_id = ? ORDER BY earned_at'
    ).all(userId);
  }

  /**
   * Display the full achievements screen for a user.
   * @param {object} connection - TelnetConnection instance
   */
  static async showAchievements(connection) {
    const user = connection.user;
    const db = getDatabase();

    // Refresh stats
    const stats = db.prepare(
      'SELECT login_count, posts, uploads, downloads, time_online, security_level FROM users WHERE id = ?'
    ).get(user.id);

    // Get earned set
    const earnedRows = AchievementService.getUserAchievements(user.id);
    const earnedMap = new Map(earnedRows.map(r => [r.achievement_id, r.earned_at]));

    const earnedCount = earnedMap.size;
    const totalCount = ACHIEVEMENTS.length;

    connection.screen.clear();
    connection.write('\r\n');
    connection.write(colorText('  ACHIEVEMENTS', 'yellow', null, true) + '\r\n');
    connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(57), 'cyan', null, true) + '\r\n');
    connection.write(
      colorText(`  Earned: ${earnedCount}/${totalCount}`, 'white', null, true) + '\r\n\r\n'
    );

    for (const ach of ACHIEVEMENTS) {
      const isEarned = earnedMap.has(ach.id);
      const milestone = MILESTONE_MAP[ach.id];

      // Icon
      let iconStr;
      if (isEarned) {
        iconStr = colorText(`[${ach.icon}]`, ach.iconColor, null, true);
      } else {
        iconStr = colorText('[ ]', 'black', null, true); // dim/gray
      }

      // Name and description
      let nameStr;
      let descStr;
      if (isEarned) {
        const earnedDate = new Date(earnedMap.get(ach.id)).toLocaleDateString();
        nameStr = colorText(ach.name.padEnd(22), 'white', null, true);
        descStr = colorText(ach.desc, 'cyan') + colorText(`  (${earnedDate})`, 'green');
      } else {
        nameStr = colorText(ach.name.padEnd(22), 'black', null, true); // dim
        // Show progress for milestone achievements
        if (milestone && stats) {
          const current = stats[milestone.stat] || 0;
          const progress = Math.min(current, milestone.threshold);
          let progressLabel;
          if (milestone.stat === 'time_online') {
            const currentHrs = Math.floor(current / 3600);
            const thresholdHrs = Math.floor(milestone.threshold / 3600);
            progressLabel = `${currentHrs}/${thresholdHrs} hrs`;
          } else {
            progressLabel = `${progress}/${milestone.threshold}`;
          }
          descStr = colorText(ach.desc, 'black', null, true) +
                    colorText(`  [${progressLabel}]`, 'yellow');
        } else {
          descStr = colorText(ach.desc, 'black', null, true);
        }
      }

      connection.write(`  ${iconStr} ${nameStr} ${descStr}\r\n`);
    }

    connection.write('\r\n');
    connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(57), 'cyan', null, true) + '\r\n');
    connection.write(colorText('  Press any key to continue...', 'white') + '\r\n');
    await connection.getChar();
  }

  /**
   * Display achievement unlock notification.
   * @param {object} connection
   * @param {object} achievement - Achievement definition object
   */
  static notifyUnlock(connection, achievement) {
    connection.write('\r\n');
    connection.write(
      colorText('  *** ', 'yellow', null, true) +
      colorText('Achievement Unlocked: ', 'white', null, true) +
      colorText(`"${achievement.name}"`, 'cyan', null, true) +
      colorText(` - ${achievement.desc}!`, 'white') +
      colorText(' ***', 'yellow', null, true) +
      '\r\n'
    );
  }

  /**
   * Display notifications for multiple newly earned achievements.
   * @param {object} connection
   * @param {object[]} achievements - Array of achievement definitions
   */
  static notifyUnlocks(connection, achievements) {
    for (const ach of achievements) {
      AchievementService.notifyUnlock(connection, ach);
    }
  }

  /**
   * Get a brief summary of earned achievements for profile display.
   * @param {number} userId
   * @returns {string[]} Array of formatted badge strings
   */
  static getProfileBadges(userId) {
    const earnedRows = AchievementService.getUserAchievements(userId);
    const badges = [];

    for (const row of earnedRows) {
      const achDef = ACHIEVEMENTS.find(a => a.id === row.achievement_id);
      if (achDef) {
        badges.push(achDef);
      }
    }

    return badges;
  }
}

export { ACHIEVEMENTS };
export default AchievementService;
