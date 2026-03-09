/**
 * Post-Authentication Login Sequence
 *
 * Displays system stats, last callers, mail notifications,
 * and new bulletins between login and main menu — classic BBS style.
 */
import getDatabase from '../database/db.js';
import { ANSI, BOX, colorText, padText } from '../utils/ansi.js';
import { displayArt } from '../utils/artloader.js';
import { Session } from '../models/Session.js';
import config from '../config/index.js';

export class LoginSequence {
  constructor(connection) {
    this.conn = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Run the full login sequence.
   */
  async show() {
    await this.showWelcomeArt();
    this.screen.clear();
    this.showSystemStats();
    this.showTopCallers();
    this.showLastCallers();
    this.showMailNotification();
    this.showNewBulletins();
    this.conn.write('\r\n');
    this.conn.write(colorText('  Press any key to continue to Main Menu...', 'white', null, true));
    await this.conn.getChar();
  }

  /**
   * Try to display welcome ANSI art if it exists.
   */
  async showWelcomeArt() {
    try {
      this.screen.clear();
      await displayArt(this.screen, 'welcome.ans');
      this.conn.write('\r\n');
      this.conn.write(colorText('  Press any key to continue...', 'white', null, false));
      await this.conn.getChar();
    } catch {
      // welcome.ans not found — skip silently
    }
  }

  /**
   * Display system statistics box.
   */
  showSystemStats() {
    const db = getDatabase();
    const now = new Date();
    const dateStr = now.toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    });
    const timeStr = now.toLocaleTimeString('en-US', {
      hour: '2-digit', minute: '2-digit',
    });

    const totalUsers = db.prepare(
      "SELECT COUNT(*) as count FROM users WHERE status = 'active'"
    ).get().count;

    const totalMessages = db.prepare(
      'SELECT COUNT(*) as count FROM messages'
    ).get().count;

    const totalFiles = db.prepare(
      'SELECT COUNT(*) as count FROM files'
    ).get().count;

    const totalCalls = db.prepare(
      'SELECT COALESCE(SUM(login_count), 0) as total FROM users'
    ).get().total;

    const onlineNow = Session.getActiveCount();

    // Draw the box
    const w = 60;
    const border = ANSI.FG_CYAN + ANSI.BRIGHT;
    const reset = ANSI.RESET;

    this.conn.write('\r\n');
    this.conn.write(border + '  ' + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(w - 2) + BOX.D_TOP_RIGHT + reset + '\r\n');

    // Title
    const title = `${config.bbs.name} — System Statistics`;
    const titlePad = Math.floor((w - 2 - title.length) / 2);
    this.conn.write(border + '  ' + BOX.D_VERTICAL + reset);
    this.conn.write(colorText(' '.repeat(titlePad) + title + ' '.repeat(w - 2 - titlePad - title.length), 'yellow', null, true));
    this.conn.write(border + BOX.D_VERTICAL + reset + '\r\n');

    this.conn.write(border + '  ' + BOX.D_T_RIGHT + BOX.D_HORIZONTAL.repeat(w - 2) + BOX.D_LEFT + reset + '\r\n');

    // Stats lines
    const stats = [
      ['Date', `${dateStr}  ${timeStr}`],
      ['Total Users', `${totalUsers}`],
      ['Total Messages', `${totalMessages}`],
      ['Total Files', `${totalFiles}`],
      ['Total Calls', `${totalCalls}`],
      ['Users Online', `${onlineNow}`],
    ];

    for (const [label, value] of stats) {
      const line = `  ${padText(label + ':', 20)}${value}`;
      this.conn.write(border + '  ' + BOX.D_VERTICAL + reset);
      this.conn.write(colorText(padText(line, w - 2), 'white'));
      this.conn.write(border + BOX.D_VERTICAL + reset + '\r\n');
    }

    this.conn.write(border + '  ' + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(w - 2) + BOX.D_BOTTOM_RIGHT + reset + '\r\n');
  }

  /**
   * Display Top 10 Callers and Top 10 Posters.
   */
  showTopCallers() {
    const db = getDatabase();

    // Top 10 callers
    const topCallers = db.prepare(`
      SELECT username, login_count
      FROM users
      WHERE status = 'active' AND login_count > 0
      ORDER BY login_count DESC
      LIMIT 10
    `).all();

    if (topCallers.length > 0) {
      this.conn.write('\r\n');
      this.conn.write(colorText('  Top 10 Callers', 'yellow', null, true) + '\r\n');
      this.conn.write(colorText('  ' + BOX.HORIZONTAL.repeat(40), 'cyan') + '\r\n');

      for (let i = 0; i < topCallers.length; i++) {
        const c = topCallers[i];
        const rank = padText(`${i + 1}.`, 4);
        this.conn.write(
          colorText(`  ${rank}`, 'white', null, true) +
          colorText(padText(c.username, 20), 'green', null, true) +
          colorText(`${c.login_count} calls`, 'white') +
          '\r\n'
        );
      }
    }

    // Top 10 posters
    const topPosters = db.prepare(`
      SELECT username, posts
      FROM users
      WHERE status = 'active' AND posts > 0
      ORDER BY posts DESC
      LIMIT 10
    `).all();

    if (topPosters.length > 0) {
      this.conn.write('\r\n');
      this.conn.write(colorText('  Top 10 Posters', 'yellow', null, true) + '\r\n');
      this.conn.write(colorText('  ' + BOX.HORIZONTAL.repeat(40), 'cyan') + '\r\n');

      for (let i = 0; i < topPosters.length; i++) {
        const p = topPosters[i];
        const rank = padText(`${i + 1}.`, 4);
        this.conn.write(
          colorText(`  ${rank}`, 'white', null, true) +
          colorText(padText(p.username, 20), 'green', null, true) +
          colorText(`${p.posts} posts`, 'white') +
          '\r\n'
        );
      }
    }
  }

  /**
   * Display the last 5 callers (excluding the current user).
   */
  showLastCallers() {
    const db = getDatabase();

    const callers = db.prepare(`
      SELECT username, last_login
      FROM users
      WHERE id != ? AND last_login IS NOT NULL AND status = 'active'
      ORDER BY last_login DESC
      LIMIT 5
    `).all(this.user.id);

    if (callers.length === 0) return;

    this.conn.write('\r\n');
    this.conn.write(colorText('  Last Callers:', 'yellow', null, true) + '\r\n');
    this.conn.write(colorText('  ' + BOX.HORIZONTAL.repeat(40), 'cyan') + '\r\n');

    for (const caller of callers) {
      const when = caller.last_login
        ? new Date(caller.last_login + 'Z').toLocaleString('en-US', {
            month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
          })
        : 'Unknown';
      this.conn.write(
        colorText(`  ${padText(caller.username, 20)}`, 'green', null, true)
        + colorText(when, 'white')
        + '\r\n'
      );
    }
  }

  /**
   * Notify the user about unread private messages.
   */
  showMailNotification() {
    const unread = this.user.getUnreadMessageCount();
    if (unread > 0) {
      this.conn.write('\r\n');
      this.conn.write(
        colorText(`  You have ${unread} new private message${unread > 1 ? 's' : ''}!`, 'yellow', null, true)
        + '\r\n'
      );
    }
  }

  /**
   * Check for bulletins posted since the user's last login.
   */
  showNewBulletins() {
    const db = getDatabase();

    // The in-memory user object was loaded before updateLastLogin() ran,
    // so this.user.last_login holds the previous login timestamp — exactly
    // what we need to find bulletins posted since the user's last visit.
    const lastLogin = this.user.last_login;

    let newBulletins = 0;
    if (lastLogin) {
      newBulletins = db.prepare(`
        SELECT COUNT(*) as count
        FROM bulletins
        WHERE created_at > ?
          AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
          AND security_level <= ?
      `).get(lastLogin, this.user.security_level).count;
    }

    if (newBulletins > 0) {
      this.conn.write('\r\n');
      this.conn.write(
        colorText(`  There ${newBulletins === 1 ? 'is' : 'are'} ${newBulletins} new bulletin${newBulletins > 1 ? 's' : ''} since your last visit.`, 'cyan', null, true)
        + '\r\n'
      );
    }
  }
}

export default LoginSequence;
