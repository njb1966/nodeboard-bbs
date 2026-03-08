/**
 * Sysop Admin Service
 */
import getDatabase from '../database/db.js';
import { colorText } from '../utils/ansi.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import config from '../config/index.js';

export class SysopService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show sysop admin menu
   */
  async show() {
    while (true) {
      const menuItems = [
        { key: 'U', text: 'User Management' },
        { key: 'B', text: 'Bulletin Management' },
        { key: 'F', text: 'Forum Management' },
        { key: 'A', text: 'File Area Management' },
        { key: 'D', text: 'DOOR Management' },
        { key: 'S', text: 'System Statistics' },
        { key: 'L', text: 'View System Logs' },
        { key: 'E', text: 'Active Sessions' },
        { key: 'Q', text: 'Return to Main Menu' },
      ];

      this.screen.menu('SYSOP ADMIN', menuItems, 'Command');

      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'U':
          await this.userManagement();
          break;

        case 'B':
          await this.bulletinManagement();
          break;

        case 'F':
          await this.forumManagement();
          break;

        case 'A':
          await this.fileAreaManagement();
          break;

        case 'D':
          await this.doorManagement();
          break;

        case 'S':
          await this.systemStatistics();
          break;

        case 'L':
          await this.viewLogs();
          break;

        case 'E':
          await this.activeSessions();
          break;

        case 'Q':
          return;
      }
    }
  }

  /**
   * User Management
   */
  async userManagement() {
    while (true) {
      const db = getDatabase();
      const users = db.prepare(`
        SELECT id, username, real_name, security_level, status, created_at, last_login
        FROM users
        ORDER BY id
        LIMIT 50
      `).all();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('USER MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      users.forEach(user => {
        const status = user.status === 'active' ? colorText('[Active]', 'green') : colorText('[Inactive]', 'red');
        this.connection.write(
          colorText(`[${user.id}] `, 'cyan', null, true) +
          colorText(user.username.padEnd(20), 'white') +
          status +
          colorText(` Level: ${user.security_level}`, 'yellow') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('Total Users: ', 'white', null, true) + colorText(users.length.toString(), 'cyan') + '\r\n');
      this.connection.write('\r\n');
      this.connection.write(colorText('Enter user ID to manage (or Q to quit): ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();
      this.connection.write('\r\n');

      if (choice === 'Q' || choice === '') {
        break;
      }

      const userId = parseInt(choice);
      if (isNaN(userId)) {
        this.screen.messageBox('Error', 'Invalid user ID.', 'error');
        await this.connection.getChar();
        continue;
      }

      const user = users.find(u => u.id === userId);
      if (!user) {
        this.screen.messageBox('Error', 'User not found.', 'error');
        await this.connection.getChar();
        continue;
      }

      await this.manageUser(user);
    }
  }

  /**
   * Manage individual user
   */
  async manageUser(user) {
    while (true) {
      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText(`MANAGE USER: ${user.username}`, 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      this.connection.write(colorText('User ID: ', 'cyan') + colorText(user.id.toString(), 'white') + '\r\n');
      this.connection.write(colorText('Username: ', 'cyan') + colorText(user.username, 'white') + '\r\n');
      this.connection.write(colorText('Real Name: ', 'cyan') + colorText(user.real_name || 'Not set', 'white') + '\r\n');
      this.connection.write(colorText('Security Level: ', 'cyan') + colorText(user.security_level.toString(), 'white') + '\r\n');
      this.connection.write(colorText('Status: ', 'cyan') + colorText(user.status, user.status === 'active' ? 'green' : 'red') + '\r\n');
      this.connection.write(colorText('Created: ', 'cyan') + colorText(new Date(user.created_at).toLocaleString(), 'white') + '\r\n');
      this.connection.write(colorText('Last Login: ', 'cyan') + colorText(user.last_login ? new Date(user.last_login).toLocaleString() : 'Never', 'white') + '\r\n');
      this.connection.write('\r\n');

      const menuItems = [
        { key: 'L', text: 'Change Security Level' },
        { key: 'A', text: user.status === 'active' ? 'Deactivate Account' : 'Activate Account' },
        { key: 'D', text: 'Delete Account' },
        { key: 'Q', text: 'Return to User List' },
      ];

      this.screen.menu('USER ACTIONS', menuItems, 'Command');
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'L':
          await this.changeUserSecurityLevel(user);
          // Refresh user data
          const db = getDatabase();
          const updated = db.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
          Object.assign(user, updated);
          break;

        case 'A':
          await this.toggleUserStatus(user);
          // Refresh user data
          const db2 = getDatabase();
          const updated2 = db2.prepare('SELECT * FROM users WHERE id = ?').get(user.id);
          Object.assign(user, updated2);
          break;

        case 'D':
          const deleted = await this.deleteUser(user);
          if (deleted) {
            return; // Exit to user list
          }
          break;

        case 'Q':
          return;
      }
    }
  }

  /**
   * Change user security level
   */
  async changeUserSecurityLevel(user) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('CHANGE SECURITY LEVEL', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    this.connection.write(colorText('Current Level: ', 'cyan') + colorText(user.security_level.toString(), 'white') + '\r\n');
    this.connection.write('\r\n');
    this.connection.write(colorText('Security Levels:', 'yellow') + '\r\n');
    this.connection.write(colorText('  10 = Normal User', 'white') + '\r\n');
    this.connection.write(colorText('  50 = Trusted User', 'white') + '\r\n');
    this.connection.write(colorText('  90 = Co-Sysop', 'white') + '\r\n');
    this.connection.write(colorText('  99 = Sysop', 'white') + '\r\n');
    this.connection.write('\r\n');

    const newLevel = await this.connection.getInput('New security level (10-99): ');
    this.connection.write('\r\n');

    const level = parseInt(newLevel);
    if (isNaN(level) || level < 10 || level > 99) {
      this.screen.messageBox('Error', 'Invalid security level. Must be between 10 and 99.', 'error');
      await this.connection.getChar();
      return;
    }

    const db = getDatabase();
    db.prepare('UPDATE users SET security_level = ? WHERE id = ?').run(level, user.id);

    this.screen.messageBox('Success', `Security level changed to ${level}.`, 'success');
    await this.connection.getChar();
  }

  /**
   * Toggle user active/inactive status
   */
  async toggleUserStatus(user) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText(`${newStatus === 'active' ? 'ACTIVATE' : 'DEACTIVATE'} USER`, 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    this.connection.write(colorText(`Are you sure you want to ${newStatus === 'active' ? 'activate' : 'deactivate'} ${user.username}? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');

    if (confirm !== 'Y') {
      this.screen.messageBox('Info', 'Action cancelled.', 'info');
      await this.connection.getChar();
      return;
    }

    const db = getDatabase();
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(newStatus, user.id);

    this.screen.messageBox('Success', `User ${newStatus === 'active' ? 'activated' : 'deactivated'}.`, 'success');
    await this.connection.getChar();
  }

  /**
   * Delete user account
   */
  async deleteUser(user) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('DELETE USER', 'red', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    this.connection.write(colorText('WARNING: This will permanently delete the user account!', 'red', null, true) + '\r\n');
    this.connection.write('\r\n');
    this.connection.write(colorText(`Are you sure you want to delete ${user.username}? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');

    if (confirm !== 'Y') {
      this.screen.messageBox('Info', 'Action cancelled.', 'info');
      await this.connection.getChar();
      return false;
    }

    this.connection.write(colorText('Type DELETE to confirm: ', 'red', null, true));
    const confirm2 = await this.connection.getInput();
    this.connection.write('\r\n');

    if (confirm2 !== 'DELETE') {
      this.screen.messageBox('Info', 'Action cancelled.', 'info');
      await this.connection.getChar();
      return false;
    }

    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);

    this.screen.messageBox('Success', 'User account deleted.', 'success');
    await this.connection.getChar();
    return true;
  }

  /**
   * Bulletin Management
   */
  async bulletinManagement() {
    while (true) {
      const db = getDatabase();
      const bulletins = db.prepare(`
        SELECT id, title, author_name, created_at
        FROM bulletins
        ORDER BY created_at DESC
        LIMIT 20
      `).all();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('BULLETIN MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      bulletins.forEach((bulletin, idx) => {
        const date = new Date(bulletin.created_at).toLocaleDateString();
        this.connection.write(
          colorText(`[${idx + 1}] `, 'green', null, true) +
          colorText(bulletin.title, 'white') +
          colorText(` - by ${bulletin.author_name} on ${date}`, 'cyan') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('[A]dd  [D]elete  [Q]uit: ', 'yellow', null, true));

      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q') {
        return;
      } else if (choice === 'A') {
        await this.addBulletin();
      } else if (choice === 'D') {
        const num = await this.connection.getInput('Bulletin number to delete: ');
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < bulletins.length) {
          db.prepare('DELETE FROM bulletins WHERE id = ?').run(bulletins[idx].id);
          this.screen.messageBox('Success', 'Bulletin deleted.', 'success');
          await this.connection.getChar();
        }
      }
    }
  }

  /**
   * Add new bulletin
   */
  async addBulletin() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('ADD NEW BULLETIN', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n\r\n');

    const title = await this.connection.getInput('Title: ');
    if (!title) return;
    this.connection.write('\r\n');

    this.connection.write('\r\nEnter content (type . on a line by itself to end):\r\n\r\n');

    const content = await this.getMultiLineInput();
    if (!content) return;

    const db = getDatabase();
    db.prepare(`
      INSERT INTO bulletins (title, content, author_id, author_name, security_level)
      VALUES (?, ?, ?, ?, 10)
    `).run(title, content, this.user.id, this.user.username);

    this.screen.messageBox('Success', 'Bulletin created successfully!', 'success');
    await this.connection.getChar();
  }

  /**
   * Forum Management
   */
  async forumManagement() {
    const db = getDatabase();
    const forums = db.prepare('SELECT * FROM forums ORDER BY id').all();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('FORUM MANAGEMENT', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    forums.forEach(forum => {
      this.connection.write(
        colorText(`[${forum.id}] `, 'cyan', null, true) +
        colorText(forum.name.padEnd(30), 'white') +
        colorText(` Posts: ${forum.post_count}  Level: ${forum.security_level}`, 'yellow') +
        '\r\n'
      );
    });

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * File Area Management
   */
  async fileAreaManagement() {
    const db = getDatabase();
    const areas = db.prepare('SELECT * FROM file_areas ORDER BY id').all();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('FILE AREA MANAGEMENT', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    areas.forEach(area => {
      this.connection.write(
        colorText(`[${area.id}] `, 'cyan', null, true) +
        colorText(area.name.padEnd(30), 'white') +
        colorText(` Files: ${area.file_count}  Level: ${area.security_level}`, 'yellow') +
        '\r\n'
      );
    });

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * DOOR Management
   */
  async doorManagement() {
    const db = getDatabase();
    const doors = db.prepare('SELECT * FROM doors ORDER BY id').all();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('DOOR GAME MANAGEMENT', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    if (doors.length === 0) {
      this.connection.write(colorText('No DOOR games configured.', 'white') + '\r\n\r\n');
      this.connection.write(colorText('To add a DOOR game, insert into the database:', 'yellow') + '\r\n');
      this.connection.write(colorText("INSERT INTO doors (name, description, command, working_dir, security_level)", 'cyan') + '\r\n');
      this.connection.write(colorText("VALUES ('Game Name', 'Description', './game', './doors/game', 10);", 'cyan') + '\r\n');
    } else {
      doors.forEach(door => {
        const status = door.enabled ? colorText('[Enabled]', 'green') : colorText('[Disabled]', 'red');
        this.connection.write(
          colorText(`[${door.id}] `, 'cyan', null, true) +
          colorText(door.name.padEnd(25), 'white') +
          status +
          colorText(` Played: ${door.times_played}`, 'yellow') +
          '\r\n'
        );
      });
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * System Statistics
   */
  async systemStatistics() {
    const db = getDatabase();

    const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    const activeUsers = db.prepare("SELECT COUNT(*) as count FROM users WHERE status = 'active'").get().count;
    const totalPosts = db.prepare('SELECT COUNT(*) as count FROM messages').get().count;
    const totalPrivateMessages = db.prepare('SELECT COUNT(*) as count FROM private_messages').get().count;
    const totalFiles = db.prepare('SELECT COUNT(*) as count FROM files').get().count;
    const activeSessions = Session.getActiveCount();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('SYSTEM STATISTICS', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    this.connection.write(colorText('BBS Name:            ', 'white', null, true) + colorText(config.bbs.name, 'cyan') + '\r\n');
    this.connection.write(colorText('Version:             ', 'white', null, true) + colorText(config.bbs.version, 'cyan') + '\r\n');
    this.connection.write(colorText('Telnet Port:         ', 'white', null, true) + colorText(config.bbs.port.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Web Port:            ', 'white', null, true) + colorText(config.web.port.toString(), 'cyan') + '\r\n');
    this.connection.write('\r\n');
    this.connection.write(colorText('Total Users:         ', 'white', null, true) + colorText(totalUsers.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Active Users:        ', 'white', null, true) + colorText(activeUsers.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Current Sessions:    ', 'white', null, true) + colorText(activeSessions.toString(), 'cyan') + '\r\n');
    this.connection.write('\r\n');
    this.connection.write(colorText('Total Forum Posts:   ', 'white', null, true) + colorText(totalPosts.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Total Private Msgs:  ', 'white', null, true) + colorText(totalPrivateMessages.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Total Files:         ', 'white', null, true) + colorText(totalFiles.toString(), 'cyan') + '\r\n');

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * View System Logs
   */
  async viewLogs() {
    const db = getDatabase();
    const logs = db.prepare(`
      SELECT * FROM system_logs
      ORDER BY created_at DESC
      LIMIT 50
    `).all();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('SYSTEM LOGS (Last 50)', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    if (logs.length === 0) {
      this.connection.write(colorText('No logs found.', 'white') + '\r\n');
    } else {
      logs.forEach(log => {
        const date = new Date(log.created_at).toLocaleString();
        const typeColor = log.log_type === 'error' ? 'red' : 'white';
        this.connection.write(
          colorText(`[${date}] `, 'cyan') +
          colorText(`${log.log_type.toUpperCase()}: `, typeColor, null, true) +
          colorText(log.message, 'white') +
          '\r\n'
        );
      });
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * Active Sessions
   */
  async activeSessions() {
    const sessions = Session.getActive();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('ACTIVE SESSIONS', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    if (sessions.length === 0) {
      this.connection.write(colorText('No active sessions.', 'white') + '\r\n');
    } else {
      sessions.forEach(session => {
        const duration = Math.floor(session.getDuration() / 60);
        this.connection.write(
          colorText((session.username || 'Guest').padEnd(20), 'cyan', null, true) +
          colorText((session.ip_address || 'Unknown').padEnd(20), 'white') +
          colorText(`Online: ${duration} min`, 'green') +
          '\r\n'
        );
      });
    }

    this.connection.write('\r\n');
    this.connection.write(colorText(`Total: ${sessions.length}`, 'yellow', null, true) + '\r\n');
    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * Get multi-line input
   */
  async getMultiLineInput() {
    const lines = [];
    let lineNum = 1;

    while (true) {
      this.connection.write(colorText(`${lineNum}: `, 'green'));
      const line = await this.connection.getInput();

      if (line === '.') {
        break;
      }

      if (line === '/ABORT') {
        return null;
      }

      lines.push(line);
      lineNum++;

      if (lineNum > 100) {
        this.connection.write(colorText('Maximum lines reached.\r\n', 'yellow'));
        break;
      }
    }

    return lines.join('\n');
  }
}

export default SysopService;
