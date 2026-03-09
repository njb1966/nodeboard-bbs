/**
 * Sysop Admin Service — full CRUD for all entities,
 * event scheduler, enhanced log viewer, theme management.
 */
import getDatabase from '../database/db.js';
import { colorText, padText } from '../utils/ansi.js';
import { Session } from '../models/Session.js';
import { User } from '../models/User.js';
import { getConnections } from '../telnet/server.js';
import { banIP, unbanIP, getBannedIPs } from './RateLimiter.js';
import { logEvent, queryLogs } from './LogService.js';
import { getAvailableCommands } from './EventScheduler.js';
import { listThemes, loadTheme, getActiveTheme, setActiveTheme } from './ThemeService.js';
import config from '../config/index.js';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export class SysopService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  TOP-LEVEL MENU
  // ═══════════════════════════════════════════════════════════════════

  async show() {
    while (true) {
      const menuItems = [
        { key: 'U', text: 'User Management' },
        { key: 'F', text: 'Forum Management' },
        { key: 'A', text: 'File Area Management' },
        { key: 'D', text: 'Door Management' },
        { key: 'B', text: 'Bulletin Management' },
        { key: 'K', text: 'Kick User' },
        { key: 'I', text: 'IP Ban Management' },
        { key: 'L', text: 'System Logs' },
        { key: 'S', text: 'System Statistics' },
        { key: 'E', text: 'Event Scheduler' },
        { key: 'T', text: 'Theme Management' },
        { key: 'Q', text: 'Return to Main Menu' },
      ];

      this.screen.menu('SYSOP ADMINISTRATION', menuItems, 'Command');
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'U': await this.userManagement(); break;
        case 'F': await this.forumManagement(); break;
        case 'A': await this.fileAreaManagement(); break;
        case 'D': await this.doorManagement(); break;
        case 'B': await this.bulletinManagement(); break;
        case 'K': await this.kickUser(); break;
        case 'I': await this.ipBanManagement(); break;
        case 'L': await this.viewLogs(); break;
        case 'S': await this.systemStatistics(); break;
        case 'E': await this.eventScheduler(); break;
        case 'T': await this.themeManagement(); break;
        case 'Q': return;
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  USER MANAGEMENT (full CRUD)
  // ═══════════════════════════════════════════════════════════════════

  async userManagement() {
    let page = 0;
    const pageSize = 10;

    while (true) {
      const db = getDatabase();
      const total = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
      const users = db.prepare(
        'SELECT id, username, real_name, email, location, security_level, status, created_at, last_login FROM users ORDER BY id LIMIT ? OFFSET ?'
      ).all(pageSize, page * pageSize);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('USER MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      users.forEach(u => {
        const status = u.status === 'active' ? colorText('[Active]', 'green') : colorText('[Inactive]', 'red');
        this.connection.write(
          colorText(`[${u.id}] `, 'cyan', null, true) +
          colorText(padText(u.username, 20), 'white') +
          status +
          colorText(` Level: ${u.security_level}`, 'yellow') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText(`Page ${page + 1}/${Math.max(1, Math.ceil(total / pageSize))}  Total: ${total}`, 'white', null, true) + '\r\n');
      this.connection.write(colorText('[#] Manage  [N]ext  [P]rev  [Q]uit: ', 'yellow', null, true));

      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q' || choice === '') return;
      if (choice === 'N') { if ((page + 1) * pageSize < total) page++; continue; }
      if (choice === 'P') { if (page > 0) page--; continue; }

      const userId = parseInt(choice);
      if (!isNaN(userId)) {
        const u = users.find(x => x.id === userId);
        if (u) await this.manageUser(u);
      }
    }
  }

  async manageUser(user) {
    while (true) {
      // Refresh
      const db = getDatabase();
      const fresh = db.prepare('SELECT id, username, real_name, email, location, security_level, status, created_at, last_login FROM users WHERE id = ?').get(user.id);
      if (!fresh) return;
      Object.assign(user, fresh);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText(`MANAGE USER: ${user.username}`, 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      this.connection.write(colorText('User ID:        ', 'cyan') + colorText(String(user.id), 'white') + '\r\n');
      this.connection.write(colorText('Username:       ', 'cyan') + colorText(user.username, 'white') + '\r\n');
      this.connection.write(colorText('Real Name:      ', 'cyan') + colorText(user.real_name || 'Not set', 'white') + '\r\n');
      this.connection.write(colorText('Email:          ', 'cyan') + colorText(user.email || 'Not set', 'white') + '\r\n');
      this.connection.write(colorText('Location:       ', 'cyan') + colorText(user.location || 'Not set', 'white') + '\r\n');
      this.connection.write(colorText('Security Level: ', 'cyan') + colorText(String(user.security_level), 'white') + '\r\n');
      this.connection.write(colorText('Status:         ', 'cyan') + colorText(user.status, user.status === 'active' ? 'green' : 'red') + '\r\n');
      this.connection.write(colorText('Created:        ', 'cyan') + colorText(user.created_at ? new Date(user.created_at).toLocaleString() : 'N/A', 'white') + '\r\n');
      this.connection.write(colorText('Last Login:     ', 'cyan') + colorText(user.last_login ? new Date(user.last_login).toLocaleString() : 'Never', 'white') + '\r\n');
      this.connection.write('\r\n');

      const menuItems = [
        { key: 'L', text: 'Change Security Level' },
        { key: 'E', text: 'Edit Profile Fields' },
        { key: 'R', text: 'Reset Password' },
        { key: 'A', text: user.status === 'active' ? 'Deactivate Account' : 'Activate Account' },
        { key: 'D', text: 'Delete Account' },
        { key: 'Q', text: 'Return to User List' },
      ];
      this.screen.menu('USER ACTIONS', menuItems, 'Command');
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'L': await this.changeUserSecurityLevel(user); break;
        case 'E': await this.editUserProfile(user); break;
        case 'R': await this.resetUserPassword(user); break;
        case 'A': await this.toggleUserStatus(user); break;
        case 'D':
          if (await this.deleteUser(user)) return;
          break;
        case 'Q': return;
      }
    }
  }

  async changeUserSecurityLevel(user) {
    this.connection.write('\r\n');
    this.connection.write(colorText('Security Levels: 10=Normal  50=Trusted  90=Co-Sysop  99=Sysop', 'white') + '\r\n');
    const input = await this.connection.getInput('New security level (10-99): ');
    this.connection.write('\r\n');

    const level = parseInt(input);
    if (isNaN(level) || level < 10 || level > 99) {
      this.screen.messageBox('Error', 'Invalid level. Must be 10-99.', 'error');
      await this.connection.getChar();
      return;
    }

    const db = getDatabase();
    db.prepare('UPDATE users SET security_level = ? WHERE id = ?').run(level, user.id);
    logEvent('SECURITY', this.user.id, this.user.username, `Changed security level for ${user.username} from ${user.security_level} to ${level}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', `Security level changed to ${level}.`, 'success');
    await this.connection.getChar();
  }

  async editUserProfile(user) {
    this.connection.write('\r\n');
    this.connection.write(colorText('Leave blank to keep current value.\r\n', 'white'));

    const email = await this.connection.getInput(`Email [${user.email || ''}]: `);
    this.connection.write('\r\n');
    const realName = await this.connection.getInput(`Real Name [${user.real_name || ''}]: `);
    this.connection.write('\r\n');
    const location = await this.connection.getInput(`Location [${user.location || ''}]: `);
    this.connection.write('\r\n');

    const updates = {};
    if (email) updates.email = email;
    if (realName) updates.real_name = realName;
    if (location) updates.location = location;

    if (Object.keys(updates).length === 0) {
      this.screen.messageBox('Info', 'No changes made.', 'info');
      await this.connection.getChar();
      return;
    }

    const db = getDatabase();
    const sets = Object.keys(updates).map(k => `${k} = ?`).join(', ');
    const vals = Object.values(updates);
    db.prepare(`UPDATE users SET ${sets} WHERE id = ?`).run(...vals, user.id);
    logEvent('ADMIN', this.user.id, this.user.username, `Edited profile for ${user.username}: ${Object.keys(updates).join(', ')}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Profile updated.', 'success');
    await this.connection.getChar();
  }

  async resetUserPassword(user) {
    this.connection.write('\r\n');
    const newPass = await this.connection.getInput('New password: ', false);
    this.connection.write('\r\n');

    if (!newPass || newPass.length < config.security.passwordMinLength) {
      this.screen.messageBox('Error', `Password must be at least ${config.security.passwordMinLength} characters.`, 'error');
      await this.connection.getChar();
      return;
    }

    const userObj = User.findById(user.id);
    if (!userObj) return;
    await userObj.changePassword(newPass);
    logEvent('SECURITY', this.user.id, this.user.username, `Reset password for ${user.username}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Password has been reset.', 'success');
    await this.connection.getChar();
  }

  async toggleUserStatus(user) {
    const newStatus = user.status === 'active' ? 'inactive' : 'active';
    this.connection.write(colorText(`\r\n${newStatus === 'active' ? 'Activate' : 'Deactivate'} ${user.username}? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');

    if (confirm !== 'Y') {
      this.screen.messageBox('Info', 'Cancelled.', 'info');
      await this.connection.getChar();
      return;
    }

    const db = getDatabase();
    db.prepare('UPDATE users SET status = ? WHERE id = ?').run(newStatus, user.id);
    logEvent('SECURITY', this.user.id, this.user.username, `${newStatus === 'active' ? 'Activated' : 'Deactivated'} user ${user.username}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', `User ${newStatus === 'active' ? 'activated' : 'deactivated'}.`, 'success');
    await this.connection.getChar();
  }

  async deleteUser(user) {
    this.connection.write(colorText('\r\nWARNING: This permanently deletes the user!\r\n', 'red', null, true));
    this.connection.write(colorText(`Delete ${user.username}? (Y/N): `, 'yellow', null, true));
    const c1 = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');
    if (c1 !== 'Y') { return false; }

    this.connection.write(colorText('Type DELETE to confirm: ', 'red', null, true));
    const c2 = await this.connection.getInput();
    this.connection.write('\r\n');
    if (c2 !== 'DELETE') { return false; }

    const db = getDatabase();
    db.prepare('DELETE FROM users WHERE id = ?').run(user.id);
    logEvent('ADMIN', this.user.id, this.user.username, `Deleted user ${user.username} (ID ${user.id})`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'User deleted.', 'success');
    await this.connection.getChar();
    return true;
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FORUM MANAGEMENT (full CRUD)
  // ═══════════════════════════════════════════════════════════════════

  async forumManagement() {
    while (true) {
      const db = getDatabase();
      const forums = db.prepare('SELECT * FROM forums ORDER BY sort_order, id').all();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('FORUM MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      forums.forEach(f => {
        this.connection.write(
          colorText(`[${f.id}] `, 'cyan', null, true) +
          colorText(padText(f.name, 30), 'white') +
          colorText(`Posts: ${String(f.post_count).padEnd(6)}`, 'yellow') +
          colorText(`Level: ${String(f.security_level).padEnd(4)}`, 'green') +
          colorText(`Order: ${f.sort_order ?? f.id}`, 'cyan') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('[A]dd  [E]dit  [D]elete  [R]eorder  [Q]uit: ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'A': await this.addForum(); break;
        case 'E': await this.editForum(forums); break;
        case 'D': await this.deleteForum(forums); break;
        case 'R': await this.reorderForums(forums); break;
        case 'Q': return;
      }
    }
  }

  async addForum() {
    this.connection.write('\r\n');
    const name = await this.connection.getInput('Forum name: ');
    if (!name) return;
    this.connection.write('\r\n');
    const desc = await this.connection.getInput('Description: ');
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput('Security level (default 10): ');
    this.connection.write('\r\n');
    const level = parseInt(levelStr) || 10;

    const db = getDatabase();
    const maxOrder = db.prepare('SELECT MAX(sort_order) as m FROM forums').get().m || 0;
    db.prepare('INSERT INTO forums (name, description, security_level, sort_order) VALUES (?, ?, ?, ?)').run(name, desc || null, level, maxOrder + 1);
    logEvent('ADMIN', this.user.id, this.user.username, `Created forum: ${name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Forum created.', 'success');
    await this.connection.getChar();
  }

  async editForum(forums) {
    const idStr = await this.connection.getInput('\r\nForum ID to edit: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const forum = forums.find(f => f.id === id);
    if (!forum) {
      this.screen.messageBox('Error', 'Forum not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText('Leave blank to keep current value.\r\n', 'white'));
    const name = await this.connection.getInput(`Name [${forum.name}]: `);
    this.connection.write('\r\n');
    const desc = await this.connection.getInput(`Description [${forum.description || ''}]: `);
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput(`Security level [${forum.security_level}]: `);
    this.connection.write('\r\n');

    const db = getDatabase();
    db.prepare('UPDATE forums SET name = ?, description = ?, security_level = ? WHERE id = ?').run(
      name || forum.name,
      desc || forum.description,
      parseInt(levelStr) || forum.security_level,
      forum.id
    );
    logEvent('ADMIN', this.user.id, this.user.username, `Edited forum: ${name || forum.name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Forum updated.', 'success');
    await this.connection.getChar();
  }

  async deleteForum(forums) {
    const idStr = await this.connection.getInput('\r\nForum ID to delete: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const forum = forums.find(f => f.id === id);
    if (!forum) {
      this.screen.messageBox('Error', 'Forum not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText(`WARNING: Deleting "${forum.name}" will also delete all ${forum.post_count} messages!\r\n`, 'red', null, true));
    this.connection.write(colorText('Are you sure? (Y/N): ', 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');

    if (confirm !== 'Y') return;

    const db = getDatabase();
    db.prepare('DELETE FROM forums WHERE id = ?').run(forum.id);
    logEvent('ADMIN', this.user.id, this.user.username, `Deleted forum: ${forum.name} (${forum.post_count} messages)`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Forum deleted.', 'success');
    await this.connection.getChar();
  }

  async reorderForums(forums) {
    this.connection.write('\r\n');
    this.connection.write(colorText('Enter forum IDs in desired order, comma-separated:\r\n', 'white'));
    this.connection.write(colorText('Example: 3,1,2,4\r\n', 'cyan'));
    const order = await this.connection.getInput('Order: ');
    this.connection.write('\r\n');

    if (!order) return;

    const ids = order.split(',').map(s => parseInt(s.trim())).filter(n => !isNaN(n));
    const db = getDatabase();
    const stmt = db.prepare('UPDATE forums SET sort_order = ? WHERE id = ?');

    ids.forEach((id, idx) => {
      stmt.run(idx + 1, id);
    });

    logEvent('ADMIN', this.user.id, this.user.username, 'Reordered forums', this.connection.remoteAddress);
    this.screen.messageBox('Success', 'Forums reordered.', 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  FILE AREA MANAGEMENT (full CRUD)
  // ═══════════════════════════════════════════════════════════════════

  async fileAreaManagement() {
    while (true) {
      const db = getDatabase();
      const areas = db.prepare('SELECT * FROM file_areas ORDER BY id').all();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('FILE AREA MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      areas.forEach(a => {
        this.connection.write(
          colorText(`[${a.id}] `, 'cyan', null, true) +
          colorText(padText(a.name, 25), 'white') +
          colorText(`Files: ${String(a.file_count).padEnd(6)}`, 'yellow') +
          colorText(`Level: ${String(a.security_level).padEnd(4)}`, 'green') +
          colorText(`Path: ${a.path}`, 'cyan') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('[A]dd  [E]dit  [D]elete  [Q]uit: ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'A': await this.addFileArea(); break;
        case 'E': await this.editFileArea(areas); break;
        case 'D': await this.deleteFileArea(areas); break;
        case 'Q': return;
      }
    }
  }

  async addFileArea() {
    this.connection.write('\r\n');
    const name = await this.connection.getInput('Area name: ');
    if (!name) return;
    this.connection.write('\r\n');
    const desc = await this.connection.getInput('Description: ');
    this.connection.write('\r\n');
    const path = await this.connection.getInput('Directory path (relative to downloads): ');
    if (!path) return;
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput('Security level (default 10): ');
    this.connection.write('\r\n');
    const level = parseInt(levelStr) || 10;

    // Ensure directory exists
    const fullPath = join(config.paths.downloads, path);
    if (!existsSync(fullPath)) {
      mkdirSync(fullPath, { recursive: true });
    }

    const db = getDatabase();
    db.prepare('INSERT INTO file_areas (name, description, path, security_level) VALUES (?, ?, ?, ?)').run(name, desc || null, path, level);
    logEvent('ADMIN', this.user.id, this.user.username, `Created file area: ${name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'File area created.', 'success');
    await this.connection.getChar();
  }

  async editFileArea(areas) {
    const idStr = await this.connection.getInput('\r\nArea ID to edit: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const area = areas.find(a => a.id === id);
    if (!area) {
      this.screen.messageBox('Error', 'Area not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText('Leave blank to keep current value.\r\n', 'white'));
    const name = await this.connection.getInput(`Name [${area.name}]: `);
    this.connection.write('\r\n');
    const desc = await this.connection.getInput(`Description [${area.description || ''}]: `);
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput(`Security level [${area.security_level}]: `);
    this.connection.write('\r\n');

    const db = getDatabase();
    db.prepare('UPDATE file_areas SET name = ?, description = ?, security_level = ? WHERE id = ?').run(
      name || area.name,
      desc || area.description,
      parseInt(levelStr) || area.security_level,
      area.id
    );
    logEvent('ADMIN', this.user.id, this.user.username, `Edited file area: ${name || area.name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'File area updated.', 'success');
    await this.connection.getChar();
  }

  async deleteFileArea(areas) {
    const idStr = await this.connection.getInput('\r\nArea ID to delete: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const area = areas.find(a => a.id === id);
    if (!area) {
      this.screen.messageBox('Error', 'Area not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText(`Delete "${area.name}" and all its file records? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');
    if (confirm !== 'Y') return;

    const db = getDatabase();
    db.prepare('DELETE FROM file_areas WHERE id = ?').run(area.id);
    logEvent('ADMIN', this.user.id, this.user.username, `Deleted file area: ${area.name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'File area deleted.', 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  DOOR MANAGEMENT (full CRUD)
  // ═══════════════════════════════════════════════════════════════════

  async doorManagement() {
    while (true) {
      const db = getDatabase();
      const doors = db.prepare('SELECT * FROM doors ORDER BY id').all();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('DOOR MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      if (doors.length === 0) {
        this.connection.write(colorText('No door games configured.\r\n', 'white'));
      } else {
        doors.forEach(d => {
          const status = d.enabled ? colorText('[ON] ', 'green') : colorText('[OFF]', 'red');
          this.connection.write(
            colorText(`[${d.id}] `, 'cyan', null, true) +
            status + ' ' +
            colorText(padText(d.name, 25), 'white') +
            colorText(`Played: ${String(d.times_played).padEnd(6)}`, 'yellow') +
            colorText(`Level: ${d.security_level}`, 'green') +
            '\r\n'
          );
        });
      }

      this.connection.write('\r\n');
      this.connection.write(colorText('[A]dd  [E]dit  [D]elete  [Q]uit: ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'A': await this.addDoor(); break;
        case 'E': await this.editDoor(doors); break;
        case 'D': await this.deleteDoor(doors); break;
        case 'Q': return;
      }
    }
  }

  async addDoor() {
    this.connection.write('\r\n');
    const name = await this.connection.getInput('Door name: ');
    if (!name) return;
    this.connection.write('\r\n');
    const desc = await this.connection.getInput('Description: ');
    this.connection.write('\r\n');
    const command = await this.connection.getInput('Command (executable name): ');
    if (!command) return;
    this.connection.write('\r\n');
    const workDir = await this.connection.getInput('Working directory: ');
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput('Security level (default 10): ');
    this.connection.write('\r\n');
    const level = parseInt(levelStr) || 10;

    const db = getDatabase();
    db.prepare('INSERT INTO doors (name, description, command, working_dir, security_level, enabled) VALUES (?, ?, ?, ?, ?, 1)').run(
      name, desc || null, command, workDir || null, level
    );
    logEvent('ADMIN', this.user.id, this.user.username, `Created door: ${name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Door created.', 'success');
    await this.connection.getChar();
  }

  async editDoor(doors) {
    const idStr = await this.connection.getInput('\r\nDoor ID to edit: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const door = doors.find(d => d.id === id);
    if (!door) {
      this.screen.messageBox('Error', 'Door not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText('Leave blank to keep current value.\r\n', 'white'));
    const name = await this.connection.getInput(`Name [${door.name}]: `);
    this.connection.write('\r\n');
    const desc = await this.connection.getInput(`Description [${(door.description || '').substring(0, 40)}]: `);
    this.connection.write('\r\n');
    const command = await this.connection.getInput(`Command [${door.command}]: `);
    this.connection.write('\r\n');
    const workDir = await this.connection.getInput(`Working dir [${door.working_dir || ''}]: `);
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput(`Security level [${door.security_level}]: `);
    this.connection.write('\r\n');
    const enabledStr = await this.connection.getInput(`Enabled (Y/N) [${door.enabled ? 'Y' : 'N'}]: `);
    this.connection.write('\r\n');

    let enabled = door.enabled;
    if (enabledStr.toUpperCase() === 'Y') enabled = 1;
    else if (enabledStr.toUpperCase() === 'N') enabled = 0;

    const db = getDatabase();
    db.prepare('UPDATE doors SET name = ?, description = ?, command = ?, working_dir = ?, security_level = ?, enabled = ? WHERE id = ?').run(
      name || door.name,
      desc || door.description,
      command || door.command,
      workDir || door.working_dir,
      parseInt(levelStr) || door.security_level,
      enabled,
      door.id
    );
    logEvent('ADMIN', this.user.id, this.user.username, `Edited door: ${name || door.name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Door updated.', 'success');
    await this.connection.getChar();
  }

  async deleteDoor(doors) {
    const idStr = await this.connection.getInput('\r\nDoor ID to delete: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const door = doors.find(d => d.id === id);
    if (!door) {
      this.screen.messageBox('Error', 'Door not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText(`Delete door "${door.name}"? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');
    if (confirm !== 'Y') return;

    const db = getDatabase();
    db.prepare('DELETE FROM doors WHERE id = ?').run(door.id);
    logEvent('ADMIN', this.user.id, this.user.username, `Deleted door: ${door.name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Door deleted.', 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  BULLETIN MANAGEMENT (full CRUD)
  // ═══════════════════════════════════════════════════════════════════

  async bulletinManagement() {
    while (true) {
      const db = getDatabase();
      const bulletins = db.prepare(
        'SELECT id, title, author_name, security_level, created_at, expires_at FROM bulletins ORDER BY created_at DESC LIMIT 20'
      ).all();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('BULLETIN MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      bulletins.forEach((b, idx) => {
        const date = new Date(b.created_at).toLocaleDateString();
        const expiry = b.expires_at ? ` Exp: ${new Date(b.expires_at).toLocaleDateString()}` : '';
        this.connection.write(
          colorText(`[${idx + 1}] `, 'green', null, true) +
          colorText(padText(b.title, 35), 'white') +
          colorText(`by ${b.author_name}  ${date}`, 'cyan') +
          colorText(`  Lvl:${b.security_level}${expiry}`, 'yellow') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('[A]dd  [E]dit  [D]elete  [Q]uit: ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'A': await this.addBulletin(); break;
        case 'E': await this.editBulletin(bulletins); break;
        case 'D': await this.deleteBulletin(bulletins); break;
        case 'Q': return;
      }
    }
  }

  async addBulletin() {
    this.connection.write('\r\n');
    const title = await this.connection.getInput('Title: ');
    if (!title) return;
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput('Security level (default 10): ');
    this.connection.write('\r\n');
    const level = parseInt(levelStr) || 10;
    const expiry = await this.connection.getInput('Expiry date (YYYY-MM-DD or blank for none): ');
    this.connection.write('\r\n');

    this.connection.write('Enter content (type . on a line by itself to end):\r\n\r\n');
    const content = await this.getMultiLineInput();
    if (!content) return;

    const db = getDatabase();
    db.prepare(
      'INSERT INTO bulletins (title, content, author_id, author_name, security_level, expires_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(title, content, this.user.id, this.user.username, level, expiry || null);
    logEvent('ADMIN', this.user.id, this.user.username, `Created bulletin: ${title}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Bulletin created.', 'success');
    await this.connection.getChar();
  }

  async editBulletin(bulletins) {
    const numStr = await this.connection.getInput('\r\nBulletin number to edit: ');
    this.connection.write('\r\n');
    const idx = parseInt(numStr) - 1;
    if (idx < 0 || idx >= bulletins.length) {
      this.screen.messageBox('Error', 'Invalid selection.', 'error');
      await this.connection.getChar();
      return;
    }

    const bulletin = bulletins[idx];
    const db = getDatabase();
    const full = db.prepare('SELECT * FROM bulletins WHERE id = ?').get(bulletin.id);
    if (!full) return;

    this.connection.write(colorText('Leave blank to keep current value.\r\n', 'white'));
    const title = await this.connection.getInput(`Title [${full.title}]: `);
    this.connection.write('\r\n');
    const levelStr = await this.connection.getInput(`Security level [${full.security_level}]: `);
    this.connection.write('\r\n');
    const expiry = await this.connection.getInput(`Expiry (YYYY-MM-DD) [${full.expires_at || 'none'}]: `);
    this.connection.write('\r\n');

    this.connection.write(colorText('Edit content? (Y/N): ', 'yellow', null, true));
    const editContent = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');

    let content = full.content;
    if (editContent === 'Y') {
      this.connection.write('Enter new content (type . on a line by itself to end):\r\n\r\n');
      const newContent = await this.getMultiLineInput();
      if (newContent) content = newContent;
    }

    const expiresAt = expiry === 'none' ? null : (expiry || full.expires_at);

    db.prepare('UPDATE bulletins SET title = ?, content = ?, security_level = ?, expires_at = ? WHERE id = ?').run(
      title || full.title,
      content,
      parseInt(levelStr) || full.security_level,
      expiresAt,
      full.id
    );
    logEvent('ADMIN', this.user.id, this.user.username, `Edited bulletin: ${title || full.title}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Bulletin updated.', 'success');
    await this.connection.getChar();
  }

  async deleteBulletin(bulletins) {
    const numStr = await this.connection.getInput('\r\nBulletin number to delete: ');
    this.connection.write('\r\n');
    const idx = parseInt(numStr) - 1;
    if (idx < 0 || idx >= bulletins.length) return;

    const db = getDatabase();
    db.prepare('DELETE FROM bulletins WHERE id = ?').run(bulletins[idx].id);
    logEvent('ADMIN', this.user.id, this.user.username, `Deleted bulletin: ${bulletins[idx].title}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Bulletin deleted.', 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  KICK USER
  // ═══════════════════════════════════════════════════════════════════

  async kickUser() {
    const connections = getConnections();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('KICK USER', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    const onlineUsers = [];
    for (const conn of connections.values()) {
      if (conn.isAuthenticated() && conn.nodeNumber !== this.connection.nodeNumber) {
        onlineUsers.push(conn);
        this.connection.write(
          colorText(`  Node ${String(conn.nodeNumber).padEnd(4)}`, 'cyan', null, true) +
          colorText(padText(conn.user.username || 'Unknown', 20), 'white') +
          colorText(conn.activity || 'Idle', 'green') +
          '\r\n'
        );
      }
    }

    if (onlineUsers.length === 0) {
      this.connection.write(colorText('No other users online to kick.\r\n', 'white'));
      this.connection.write(colorText('Press any key to continue...\r\n', 'white'));
      await this.connection.getChar();
      return;
    }

    this.connection.write('\r\n');
    const nodeInput = await this.connection.getInput('Enter node number to kick (or Q to cancel): ');
    this.connection.write('\r\n');

    if (!nodeInput || nodeInput.toUpperCase() === 'Q') return;

    const nodeNum = parseInt(nodeInput);
    if (isNaN(nodeNum) || nodeNum === this.connection.nodeNumber) {
      this.screen.messageBox('Error', 'Invalid node number.', 'error');
      await this.connection.getChar();
      return;
    }

    let targetConn = null;
    for (const conn of connections.values()) {
      if (conn.nodeNumber === nodeNum) { targetConn = conn; break; }
    }

    if (!targetConn || !targetConn.isAuthenticated()) {
      this.screen.messageBox('Error', 'No authenticated user on that node.', 'error');
      await this.connection.getChar();
      return;
    }

    const targetName = targetConn.user.username;
    this.connection.write(colorText(`Kick ${targetName} from node ${nodeNum}? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');

    if (confirm !== 'Y') return;

    try { targetConn.write(colorText('\r\n\r\nYou have been disconnected by the Sysop.\r\n', 'red', null, true)); } catch (_) {}
    if (targetConn.session) Session.forceEnd(targetConn.session.id);
    try { targetConn.socket.end(); } catch (_) { try { targetConn.socket.destroy(); } catch (_e) {} }

    logEvent('ADMIN', this.user.id, this.user.username, `Kicked user ${targetName} from node ${nodeNum}`, this.connection.remoteAddress);
    this.screen.messageBox('Success', `${targetName} has been kicked.`, 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  IP BAN MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  async ipBanManagement() {
    while (true) {
      const banned = getBannedIPs();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('IP BAN MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      if (banned.length === 0) {
        this.connection.write(colorText('No banned IPs.\r\n', 'white'));
      } else {
        this.connection.write(
          colorText('  #   ', 'cyan', null, true) +
          colorText(padText('IP Address', 20), 'white', null, true) +
          colorText(padText('Reason', 30), 'white', null, true) +
          colorText(padText('Banned By', 15), 'white', null, true) +
          colorText('Date', 'white', null, true) + '\r\n'
        );
        this.connection.write(colorText('  ' + '-'.repeat(76), 'cyan') + '\r\n');

        banned.forEach((entry, idx) => {
          const date = new Date(entry.banned_at).toLocaleDateString();
          this.connection.write(
            colorText(`  ${String(idx + 1).padEnd(4)}`, 'cyan', null, true) +
            colorText(padText(entry.ip_address || '', 20), 'white') +
            colorText(padText(entry.reason || 'No reason', 30), 'yellow') +
            colorText(padText(entry.banned_by || 'System', 15), 'white') +
            colorText(date, 'cyan') + '\r\n'
          );
        });
      }

      this.connection.write('\r\n');
      this.connection.write(colorText('[B]an IP  [U]nban IP  [Q]uit: ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q' || choice === '') return;
      if (choice === 'B') await this.banIPPrompt();
      if (choice === 'U') await this.unbanIPPrompt(banned);
    }
  }

  async banIPPrompt() {
    this.connection.write('\r\n');
    const ip = await this.connection.getInput('IP address to ban: ');
    this.connection.write('\r\n');
    if (!ip) return;

    const reason = await this.connection.getInput('Reason (optional): ');
    this.connection.write('\r\n');

    this.connection.write(colorText(`Ban IP ${ip}? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');
    if (confirm !== 'Y') return;

    banIP(ip, reason || null, this.user.username);
    logEvent('SECURITY', this.user.id, this.user.username, `Banned IP: ${ip} (${reason || 'no reason'})`, this.connection.remoteAddress);

    this.screen.messageBox('Success', `IP ${ip} has been banned.`, 'success');
    await this.connection.getChar();
  }

  async unbanIPPrompt(banned) {
    if (banned.length === 0) {
      this.screen.messageBox('Info', 'No banned IPs to unban.', 'info');
      await this.connection.getChar();
      return;
    }

    this.connection.write('\r\n');
    const numInput = await this.connection.getInput('Ban number to remove (or Q to cancel): ');
    this.connection.write('\r\n');
    if (!numInput || numInput.toUpperCase() === 'Q') return;

    const idx = parseInt(numInput) - 1;
    if (isNaN(idx) || idx < 0 || idx >= banned.length) {
      this.screen.messageBox('Error', 'Invalid selection.', 'error');
      await this.connection.getChar();
      return;
    }

    const entry = banned[idx];
    this.connection.write(colorText(`Unban IP ${entry.ip_address}? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');
    if (confirm !== 'Y') return;

    unbanIP(entry.ip_address);
    logEvent('SECURITY', this.user.id, this.user.username, `Unbanned IP: ${entry.ip_address}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', `IP ${entry.ip_address} unbanned.`, 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SYSTEM LOGS (enhanced viewer)
  // ═══════════════════════════════════════════════════════════════════

  async viewLogs() {
    let page = 0;
    const pageSize = 20;
    let filterType = null;
    let filterUser = null;
    let filterDateFrom = null;
    let filterDateTo = null;

    while (true) {
      const { rows: logs, total } = queryLogs({
        type: filterType,
        username: filterUser,
        dateFrom: filterDateFrom,
        dateTo: filterDateTo,
        limit: pageSize,
        offset: page * pageSize,
      });

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('SYSTEM LOGS', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');

      // Show active filters
      const filters = [];
      if (filterType) filters.push(`Type: ${filterType}`);
      if (filterUser) filters.push(`User: ${filterUser}`);
      if (filterDateFrom) filters.push(`From: ${filterDateFrom}`);
      if (filterDateTo) filters.push(`To: ${filterDateTo}`);
      if (filters.length > 0) {
        this.connection.write(colorText(`Filters: ${filters.join(' | ')}`, 'cyan') + '\r\n');
      }
      this.connection.write('\r\n');

      if (logs.length === 0) {
        this.connection.write(colorText('No logs found.\r\n', 'white'));
      } else {
        logs.forEach(log => {
          const date = new Date(log.created_at).toLocaleString();
          const typeColors = {
            'LOGIN': 'green', 'LOGOUT': 'green', 'LOGIN_FAILED': 'red',
            'SIGNUP': 'cyan', 'SECURITY': 'yellow', 'ADMIN': 'yellow',
            'SYSTEM': 'white', 'CHAT': 'cyan', 'FILE': 'green', 'ERROR': 'red',
          };
          const tc = typeColors[log.log_type] || 'white';
          this.connection.write(
            colorText(`[${date}] `, 'cyan') +
            colorText(padText(log.log_type, 14), tc, null, true) +
            colorText(padText(log.username || 'system', 16), 'white') +
            colorText(log.message.substring(0, 60), 'white') +
            '\r\n'
          );
        });
      }

      this.connection.write('\r\n');
      this.connection.write(colorText(`Page ${page + 1}/${Math.max(1, Math.ceil(total / pageSize))}  Total: ${total}`, 'white', null, true) + '\r\n');
      this.connection.write(colorText('[N]ext [P]rev [T]ype [U]ser [D]ate [C]lear [X]port [Q]uit: ', 'yellow', null, true));

      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'N':
          if ((page + 1) * pageSize < total) page++;
          break;
        case 'P':
          if (page > 0) page--;
          break;
        case 'T': {
          this.connection.write('\r\n');
          this.connection.write(colorText('Types: LOGIN, LOGOUT, LOGIN_FAILED, SIGNUP, SECURITY, ADMIN, SYSTEM, CHAT, FILE, ERROR\r\n', 'white'));
          const t = await this.connection.getInput('Filter by type (blank for all): ');
          this.connection.write('\r\n');
          filterType = t.toUpperCase() || null;
          page = 0;
          break;
        }
        case 'U': {
          const u = await this.connection.getInput('\r\nFilter by username (blank for all): ');
          this.connection.write('\r\n');
          filterUser = u || null;
          page = 0;
          break;
        }
        case 'D': {
          this.connection.write('\r\n');
          const from = await this.connection.getInput('From date (YYYY-MM-DD, blank for none): ');
          this.connection.write('\r\n');
          const to = await this.connection.getInput('To date (YYYY-MM-DD, blank for none): ');
          this.connection.write('\r\n');
          filterDateFrom = from || null;
          filterDateTo = to ? to + 'T23:59:59' : null;
          page = 0;
          break;
        }
        case 'C':
          filterType = null; filterUser = null; filterDateFrom = null; filterDateTo = null;
          page = 0;
          break;
        case 'X':
          await this.exportLogs({ type: filterType, username: filterUser, dateFrom: filterDateFrom, dateTo: filterDateTo });
          break;
        case 'Q':
          return;
      }
    }
  }

  async exportLogs(filters) {
    const { rows } = queryLogs({ ...filters, limit: 10000, offset: 0 });

    const logsDir = config.paths.logs;
    if (!existsSync(logsDir)) mkdirSync(logsDir, { recursive: true });

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = join(logsDir, `syslog-export-${timestamp}.txt`);

    const lines = rows.map(l => {
      const date = new Date(l.created_at).toISOString();
      return `${date}  ${padText(l.log_type, 14)}  ${padText(l.username || 'system', 16)}  ${l.message}`;
    });

    writeFileSync(filePath, lines.join('\n'), 'utf8');
    this.screen.messageBox('Success', `Exported ${rows.length} log entries to ${filePath}`, 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  SYSTEM STATISTICS
  // ═══════════════════════════════════════════════════════════════════

  async systemStatistics() {
    const db = getDatabase();

    const totalUsers = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const activeUsers = db.prepare("SELECT COUNT(*) as c FROM users WHERE status = 'active'").get().c;
    const totalPosts = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const totalPMs = db.prepare('SELECT COUNT(*) as c FROM private_messages').get().c;
    const totalFiles = db.prepare('SELECT COUNT(*) as c FROM files').get().c;
    const activeSessions = Session.getActiveCount();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('SYSTEM STATISTICS', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    const stat = (label, value) => {
      this.connection.write(colorText(padText(label, 25), 'white', null, true) + colorText(value, 'cyan') + '\r\n');
    };

    stat('BBS Name:', config.bbs.name);
    stat('Version:', config.bbs.version);
    stat('Telnet Port:', String(config.bbs.port));
    stat('Web Port:', String(config.web.port));
    this.connection.write('\r\n');
    stat('Total Users:', String(totalUsers));
    stat('Active Users:', String(activeUsers));
    stat('Current Sessions:', String(activeSessions));
    this.connection.write('\r\n');
    stat('Total Forum Posts:', String(totalPosts));
    stat('Total Private Msgs:', String(totalPMs));
    stat('Total Files:', String(totalFiles));

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...\r\n', 'white'));
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  EVENT SCHEDULER
  // ═══════════════════════════════════════════════════════════════════

  async eventScheduler() {
    while (true) {
      const db = getDatabase();
      const events = db.prepare('SELECT * FROM scheduled_events ORDER BY id').all();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('EVENT SCHEDULER', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      if (events.length === 0) {
        this.connection.write(colorText('No scheduled events.\r\n', 'white'));
      } else {
        events.forEach(e => {
          const status = e.enabled ? colorText('[ON] ', 'green') : colorText('[OFF]', 'red');
          const lastRun = e.last_run ? new Date(e.last_run).toLocaleString() : 'Never';
          const nextRun = e.next_run ? new Date(e.next_run).toLocaleString() : 'Pending';
          this.connection.write(
            colorText(`[${e.id}] `, 'cyan', null, true) +
            status + ' ' +
            colorText(padText(e.name, 20), 'white') +
            colorText(`${e.schedule_type}:${e.schedule_value}`, 'yellow') +
            '\r\n' +
            colorText('     ', 'white') +
            colorText(`Cmd: ${e.command}  Last: ${lastRun}  Next: ${nextRun}`, 'cyan') +
            '\r\n'
          );
        });
      }

      this.connection.write('\r\n');
      this.connection.write(colorText('[A]dd  [E]dit  [D]elete  [Q]uit: ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'A': await this.addEvent(); break;
        case 'E': await this.editEvent(events); break;
        case 'D': await this.deleteEvent(events); break;
        case 'Q': return;
      }
    }
  }

  async addEvent() {
    this.connection.write('\r\n');
    const name = await this.connection.getInput('Event name: ');
    if (!name) return;
    this.connection.write('\r\n');
    const desc = await this.connection.getInput('Description: ');
    this.connection.write('\r\n');

    const cmds = getAvailableCommands();
    this.connection.write(colorText('Available commands:\r\n', 'white'));
    cmds.forEach((c, i) => {
      this.connection.write(colorText(`  ${i + 1}. ${c}\r\n`, 'cyan'));
    });
    const cmdChoice = await this.connection.getInput('Select command number: ');
    this.connection.write('\r\n');
    const cmdIdx = parseInt(cmdChoice) - 1;
    if (cmdIdx < 0 || cmdIdx >= cmds.length) {
      this.screen.messageBox('Error', 'Invalid command.', 'error');
      await this.connection.getChar();
      return;
    }
    const command = cmds[cmdIdx];

    this.connection.write(colorText('Schedule types: interval, daily, weekly\r\n', 'white'));
    const schedType = await this.connection.getInput('Schedule type: ');
    this.connection.write('\r\n');
    if (!['interval', 'daily', 'weekly'].includes(schedType)) {
      this.screen.messageBox('Error', 'Invalid schedule type.', 'error');
      await this.connection.getChar();
      return;
    }

    let valueHint = '';
    if (schedType === 'interval') valueHint = 'minutes (e.g. 60)';
    else if (schedType === 'daily') valueHint = 'HH:MM (e.g. 03:00)';
    else if (schedType === 'weekly') valueHint = 'day,HH:MM (e.g. 0,03:00 for Sunday 3am)';

    const schedValue = await this.connection.getInput(`Schedule value (${valueHint}): `);
    this.connection.write('\r\n');
    if (!schedValue) return;

    const db = getDatabase();
    db.prepare(
      'INSERT INTO scheduled_events (name, description, command, schedule_type, schedule_value) VALUES (?, ?, ?, ?, ?)'
    ).run(name, desc || null, command, schedType, schedValue);
    logEvent('ADMIN', this.user.id, this.user.username, `Created scheduled event: ${name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Event created.', 'success');
    await this.connection.getChar();
  }

  async editEvent(events) {
    const idStr = await this.connection.getInput('\r\nEvent ID to edit: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const evt = events.find(e => e.id === id);
    if (!evt) {
      this.screen.messageBox('Error', 'Event not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText('Leave blank to keep current value.\r\n', 'white'));
    const name = await this.connection.getInput(`Name [${evt.name}]: `);
    this.connection.write('\r\n');
    const desc = await this.connection.getInput(`Description [${evt.description || ''}]: `);
    this.connection.write('\r\n');
    const schedType = await this.connection.getInput(`Schedule type [${evt.schedule_type}]: `);
    this.connection.write('\r\n');
    const schedValue = await this.connection.getInput(`Schedule value [${evt.schedule_value}]: `);
    this.connection.write('\r\n');
    const enabledStr = await this.connection.getInput(`Enabled (Y/N) [${evt.enabled ? 'Y' : 'N'}]: `);
    this.connection.write('\r\n');

    let enabled = evt.enabled;
    if (enabledStr.toUpperCase() === 'Y') enabled = 1;
    else if (enabledStr.toUpperCase() === 'N') enabled = 0;

    const db = getDatabase();
    db.prepare(
      'UPDATE scheduled_events SET name = ?, description = ?, schedule_type = ?, schedule_value = ?, enabled = ? WHERE id = ?'
    ).run(
      name || evt.name,
      desc || evt.description,
      schedType || evt.schedule_type,
      schedValue || evt.schedule_value,
      enabled,
      evt.id
    );
    logEvent('ADMIN', this.user.id, this.user.username, `Edited scheduled event: ${name || evt.name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Event updated.', 'success');
    await this.connection.getChar();
  }

  async deleteEvent(events) {
    const idStr = await this.connection.getInput('\r\nEvent ID to delete: ');
    this.connection.write('\r\n');
    const id = parseInt(idStr);
    const evt = events.find(e => e.id === id);
    if (!evt) {
      this.screen.messageBox('Error', 'Event not found.', 'error');
      await this.connection.getChar();
      return;
    }

    this.connection.write(colorText(`Delete event "${evt.name}"? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    this.connection.write('\r\n');
    if (confirm !== 'Y') return;

    const db = getDatabase();
    db.prepare('DELETE FROM scheduled_events WHERE id = ?').run(evt.id);
    logEvent('ADMIN', this.user.id, this.user.username, `Deleted scheduled event: ${evt.name}`, this.connection.remoteAddress);

    this.screen.messageBox('Success', 'Event deleted.', 'success');
    await this.connection.getChar();
  }

  // ═══════════════════════════════════════════════════════════════════
  //  THEME MANAGEMENT
  // ═══════════════════════════════════════════════════════════════════

  async themeManagement() {
    while (true) {
      const themes = listThemes();
      const active = getActiveTheme();

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('THEME MANAGEMENT', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      this.connection.write(colorText(`Active theme: ${active.name}`, 'green', null, true) + '\r\n\r\n');

      themes.forEach((t, idx) => {
        const theme = loadTheme(t);
        const marker = theme && theme.name === active.name ? ' *' : '';
        this.connection.write(
          colorText(`[${idx + 1}] `, 'cyan', null, true) +
          colorText(`${t}${marker}`, 'white') +
          colorText(theme ? ` — ${theme.name} by ${theme.author}` : '', 'cyan') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('[#] Select theme  [Q]uit: ', 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q' || choice === '') return;

      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < themes.length) {
        const success = setActiveTheme(themes[idx]);
        if (success) {
          logEvent('ADMIN', this.user.id, this.user.username, `Changed theme to: ${themes[idx]}`, this.connection.remoteAddress);
          this.screen.messageBox('Success', `Theme changed to "${themes[idx]}".`, 'success');
        } else {
          this.screen.messageBox('Error', 'Failed to load theme.', 'error');
        }
        await this.connection.getChar();
      }
    }
  }

  // ═══════════════════════════════════════════════════════════════════
  //  HELPERS
  // ═══════════════════════════════════════════════════════════════════

  async getMultiLineInput() {
    const lines = [];
    let lineNum = 1;

    while (true) {
      this.connection.write(colorText(`${lineNum}: `, 'green'));
      const line = await this.connection.getInput();

      if (line === '.') break;
      if (line === '/ABORT') return null;

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
