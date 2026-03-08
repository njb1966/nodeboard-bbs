/**
 * User Service
 */
import getDatabase from '../database/db.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { colorText } from '../utils/ansi.js';
import { wordWrap } from '../utils/text.js';
import config from '../config/index.js';

export class UserService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show user list
   */
  async showUserList() {
    const users = User.getAll(50, 0);

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('USER LIST', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');
    this.connection.write(
      colorText('USER', 'white', null, true) + '                  ' +
      colorText('POSTS', 'white', null, true) + '     ' +
      colorText('UPLOADS', 'white', null, true) + '   ' +
      colorText('DOWNLOADS', 'white', null, true) + '  ' +
      colorText('LAST LOGIN', 'white', null, true) + '\r\n'
    );
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');

    users.forEach(user => {
      const lastLogin = user.last_login
        ? new Date(user.last_login).toLocaleDateString()
        : 'Never';

      const username = (user.username || '').padEnd(20);
      const posts = (user.posts || 0).toString().padStart(5);
      const uploads = (user.uploads || 0).toString().padStart(7);
      const downloads = (user.downloads || 0).toString().padStart(9);

      this.connection.write(
        colorText(username, 'cyan') +
        colorText(posts, 'white') + '     ' +
        colorText(uploads, 'white') + '   ' +
        colorText(downloads, 'white') + '  ' +
        colorText(lastLogin, 'white') + '\r\n'
      );
    });

    this.connection.write('\r\n');
    this.connection.write(colorText(`Total users: ${User.getCount()}`, 'yellow', null, true) + '\r\n\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * Show who's online
   */
  async showWhosOnline() {
    const sessions = Session.getActive();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('WHO\'S ONLINE', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');

    if (sessions.length === 0) {
      this.connection.write(colorText('No users currently online.', 'white') + '\r\n');
    } else {
      this.connection.write(
        colorText('USER', 'white', null, true) + '                  ' +
        colorText('LOCATION', 'white', null, true) + '               ' +
        colorText('ONLINE FOR', 'white', null, true) + '\r\n'
      );
      this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');

      sessions.forEach(session => {
        const username = (session.username || 'Guest').padEnd(20);
        const location = (session.ip_address || 'Unknown').padEnd(20);
        const duration = Math.floor(session.getDuration() / 60);
        const timeStr = `${duration} min${duration !== 1 ? 's' : ''}`;

        this.connection.write(
          colorText(username, 'cyan') +
          colorText(location, 'white') +
          colorText(timeStr, 'green') + '\r\n'
        );
      });
    }

    this.connection.write('\r\n');
    this.connection.write(colorText(`Total online: ${sessions.length}`, 'yellow', null, true) + '\r\n\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * Show bulletins
   */
  async showBulletins() {
    const db = getDatabase();
    const bulletins = db.prepare(`
      SELECT * FROM bulletins
      WHERE security_level <= ? AND (expires_at IS NULL OR expires_at > datetime('now'))
      ORDER BY created_at DESC
      LIMIT 20
    `).all(this.user.security_level);

    if (bulletins.length === 0) {
      this.screen.messageBox('Info', 'No bulletins available.', 'info');
      await this.connection.getChar();
      return;
    }

    for (const bulletin of bulletins) {
      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');
      this.connection.write(colorText(bulletin.title, 'yellow', null, true) + '\r\n');
      this.connection.write(colorText(`By: ${bulletin.author_name} - ${new Date(bulletin.created_at).toLocaleDateString()}`, 'white') + '\r\n');
      this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');
      this.connection.write(wordWrap(bulletin.content) + '\r\n\r\n');
      this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');

      this.connection.write(colorText('Press any key for next bulletin (or Q to quit)...', 'white') + '\r\n');
      const key = await this.connection.getChar();
      if (key.toUpperCase() === 'Q') {
        break;
      }
    }
  }

  /**
   * Show user settings
   */
  async showSettings() {
    while (true) {
      const menuItems = [
        { key: 'P', text: 'Change Password' },
        { key: 'E', text: 'Edit Profile' },
        { key: 'S', text: 'View Statistics' },
        { key: 'Q', text: 'Return to Main Menu' },
      ];

      this.screen.menu('USER SETTINGS', menuItems, 'Command');

      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'P':
          await this.changePassword();
          break;

        case 'E':
          await this.editProfile();
          break;

        case 'S':
          await this.viewStatistics();
          break;

        case 'Q':
          return;
      }
    }
  }

  /**
   * Change password
   */
  async changePassword() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('CHANGE PASSWORD', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n\r\n');

    const currentPassword = await this.connection.getInput('Current password: ', false);

    if (!await this.user.verifyPassword(currentPassword)) {
      this.screen.messageBox('Error', 'Incorrect current password.', 'error');
      await this.connection.getChar();
      return;
    }

    const newPassword = await this.connection.getInput('New password: ', false);
    const confirmPassword = await this.connection.getInput('Confirm new password: ', false);

    if (newPassword !== confirmPassword) {
      this.screen.messageBox('Error', 'Passwords do not match.', 'error');
      await this.connection.getChar();
      return;
    }

    try {
      await this.user.changePassword(newPassword);
      this.screen.messageBox('Success', 'Password changed successfully!', 'success');
      await this.connection.getChar();
    } catch (error) {
      this.screen.messageBox('Error', error.message, 'error');
      await this.connection.getChar();
    }
  }

  /**
   * Edit profile
   */
  async editProfile() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('EDIT PROFILE', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n\r\n');

    this.connection.write(colorText(`Current email: ${this.user.email || 'Not set'}`, 'white') + '\r\n');
    const email = await this.connection.getInput('New email (or ENTER to keep): ');
    this.connection.write('\r\n');

    this.connection.write(colorText(`Current real name: ${this.user.real_name || 'Not set'}`, 'white') + '\r\n');
    const realName = await this.connection.getInput('New real name (or ENTER to keep): ');
    this.connection.write('\r\n');

    this.connection.write(colorText(`Current location: ${this.user.location || 'Not set'}`, 'white') + '\r\n');
    const location = await this.connection.getInput('New location (or ENTER to keep): ');
    this.connection.write('\r\n');

    const updates = {};
    if (email) updates.email = email;
    if (realName) updates.real_name = realName;
    if (location) updates.location = location;

    if (Object.keys(updates).length > 0) {
      this.user.updateProfile(updates);
      this.screen.messageBox('Success', 'Profile updated successfully!', 'success');
    } else {
      this.screen.messageBox('Info', 'No changes made.', 'info');
    }

    await this.connection.getChar();
  }

  /**
   * View statistics
   */
  async viewStatistics() {
    const hoursOnline = Math.floor(this.user.time_online / 3600);
    const minutesOnline = Math.floor((this.user.time_online % 3600) / 60);

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('USER STATISTICS', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    this.connection.write(colorText('Username:        ', 'white', null, true) + colorText(this.user.username, 'cyan') + '\r\n');
    this.connection.write(colorText('Real Name:       ', 'white', null, true) + colorText(this.user.real_name || 'Not set', 'cyan') + '\r\n');
    this.connection.write(colorText('Location:        ', 'white', null, true) + colorText(this.user.location || 'Not set', 'cyan') + '\r\n');
    this.connection.write(colorText('Security Level:  ', 'white', null, true) + colorText(this.user.security_level.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Member Since:    ', 'white', null, true) + colorText(new Date(this.user.created_at).toLocaleDateString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Last Login:      ', 'white', null, true) + colorText(new Date(this.user.last_login).toLocaleString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Login Count:     ', 'white', null, true) + colorText(this.user.login_count.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Time Online:     ', 'white', null, true) + colorText(`${hoursOnline}h ${minutesOnline}m`, 'cyan') + '\r\n');
    this.connection.write(colorText('Posts:           ', 'white', null, true) + colorText(this.user.posts.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Uploads:         ', 'white', null, true) + colorText(this.user.uploads.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Downloads:       ', 'white', null, true) + colorText(this.user.downloads.toString(), 'cyan') + '\r\n');
    this.connection.write(colorText('Unread Mail:     ', 'white', null, true) + colorText(this.user.getUnreadMessageCount().toString(), 'cyan') + '\r\n');

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }
}

export default UserService;
