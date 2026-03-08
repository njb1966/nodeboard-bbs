/**
 * Private Message Service
 */
import getDatabase from '../database/db.js';
import { colorText } from '../utils/ansi.js';
import { User } from '../models/User.js';

export class MessageService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Word wrap text to fit terminal width
   */
  wordWrap(text, width = 78) {
    const lines = [];
    const paragraphs = text.split('\n');

    for (const paragraph of paragraphs) {
      if (paragraph.trim() === '') {
        lines.push('');
        continue;
      }

      const words = paragraph.split(' ');
      let currentLine = '';

      for (const word of words) {
        if ((currentLine + word).length > width) {
          if (currentLine.length > 0) {
            lines.push(currentLine.trim());
            currentLine = word + ' ';
          } else {
            lines.push(word);
            currentLine = '';
          }
        } else {
          currentLine += word + ' ';
        }
      }

      if (currentLine.trim().length > 0) {
        lines.push(currentLine.trim());
      }
    }

    return lines.join('\r\n');
  }

  /**
   * Show private mail menu
   */
  async show() {
    while (true) {
      const unreadCount = this.user.getUnreadMessageCount();

      const menuItems = [
        { key: 'R', text: `Read Mail (${unreadCount} unread)` },
        { key: 'S', text: 'Send Mail' },
        { key: 'Q', text: 'Return to Main Menu' },
      ];

      this.screen.menu('PRIVATE MAIL', menuItems, 'Command');

      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'R':
          await this.readMail();
          break;

        case 'S':
          await this.sendMail();
          break;

        case 'Q':
          return;
      }
    }
  }

  /**
   * Read mail
   */
  async readMail() {
    const db = getDatabase();
    const messages = db.prepare(`
      SELECT pm.*, u.username as from_username
      FROM private_messages pm
      JOIN users u ON pm.from_user_id = u.id
      WHERE pm.to_user_id = ? AND pm.is_deleted_by_receiver = 0
      ORDER BY pm.created_at DESC
      LIMIT 50
    `).all(this.user.id);

    if (messages.length === 0) {
      this.screen.messageBox('Info', 'You have no messages.', 'info');
      await this.connection.getChar();
      return;
    }

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('YOUR PRIVATE MAIL', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');

    messages.forEach((msg, idx) => {
      const status = msg.is_read ? ' ' : colorText('*', 'red', null, true);
      const date = new Date(msg.created_at).toLocaleDateString();

      this.connection.write(
        status +
        colorText(`[${idx + 1}] `, 'green', null, true) +
        colorText(msg.subject, 'white') +
        colorText(` - from ${msg.from_username} on ${date}`, 'cyan') +
        '\r\n'
      );
    });

    this.connection.write('\r\n');
    const msgNum = await this.connection.getInput('Read message #(or Q to quit): ');

    if (msgNum.toUpperCase() === 'Q') return;

    const idx = parseInt(msgNum) - 1;
    if (idx >= 0 && idx < messages.length) {
      await this.displayMessage(messages[idx]);
    }
  }

  /**
   * Display a message
   */
  async displayMessage(message) {
    const db = getDatabase();

    // Mark as read
    if (!message.is_read) {
      db.prepare(`
        UPDATE private_messages
        SET is_read = 1, read_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `).run(message.id);
    }

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');
    this.connection.write(colorText(`Subject: ${message.subject}`, 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(`From: ${message.from_username}`, 'white') + '\r\n');
    this.connection.write(colorText(`Date: ${new Date(message.created_at).toLocaleString()}`, 'white') + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');
    this.connection.write(this.wordWrap(message.body) + '\r\n\r\n');

    this.connection.write(colorText('[R]eply  [D]elete  [Q]uit: ', 'yellow', null, true));
    const choice = (await this.connection.getInput()).toUpperCase();

    if (choice === 'R') {
      await this.replyToMail(message);
    } else if (choice === 'D') {
      db.prepare('UPDATE private_messages SET is_deleted_by_receiver = 1 WHERE id = ?').run(message.id);
      this.screen.messageBox('Success', 'Message deleted.', 'success');
      await this.connection.getChar();
    }
  }

  /**
   * Send mail
   */
  async sendMail(toUsername = null, subject = null) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('SEND PRIVATE MAIL', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n\r\n');

    if (!toUsername) {
      toUsername = await this.connection.getInput('To (username): ');
      this.connection.write('\r\n');
    }

    if (!toUsername) return;

    const toUser = User.findByUsername(toUsername);
    if (!toUser) {
      this.screen.messageBox('Error', 'User not found.', 'error');
      await this.connection.getChar();
      return;
    }

    if (!subject) {
      subject = await this.connection.getInput('Subject: ');
      this.connection.write('\r\n');
    }

    if (!subject) return;

    this.connection.write('\r\nEnter message (type . on a line by itself to end):\r\n\r\n');

    const body = await this.getMultiLineInput();
    if (!body) return;

    const db = getDatabase();
    db.prepare(`
      INSERT INTO private_messages (from_user_id, to_user_id, subject, body)
      VALUES (?, ?, ?, ?)
    `).run(this.user.id, toUser.id, subject, body);

    this.screen.messageBox('Success', 'Message sent successfully!', 'success');
    await this.connection.getChar();
  }

  /**
   * Reply to mail
   */
  async replyToMail(originalMessage) {
    const subject = originalMessage.subject.startsWith('Re: ')
      ? originalMessage.subject
      : 'Re: ' + originalMessage.subject;

    await this.sendMail(originalMessage.from_username, subject);
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

export default MessageService;
