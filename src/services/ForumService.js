/**
 * Forum/Message Board Service
 */
import getDatabase from '../database/db.js';
import { colorText } from '../utils/ansi.js';
import { wordWrap } from '../utils/text.js';

export class ForumService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show forum list
   */
  async show() {
    while (true) {
      const db = getDatabase();
      const forums = db.prepare(`
        SELECT * FROM forums
        WHERE security_level <= ?
        ORDER BY id
      `).all(this.user.security_level);

      const menuItems = forums.map((forum, idx) => ({
        key: (idx + 1).toString(),
        text: `${forum.name} (${forum.post_count} posts)`,
      }));

      menuItems.push({ key: 'Q', text: 'Return to Main Menu' });

      this.screen.menu('MESSAGE FORUMS', menuItems, 'Forum');

      const choice = await this.connection.getInput();

      if (choice.toUpperCase() === 'Q') {
        return;
      }

      const forumIdx = parseInt(choice) - 1;
      if (forumIdx >= 0 && forumIdx < forums.length) {
        await this.showForum(forums[forumIdx]);
      }
    }
  }

  /**
   * Show forum messages
   */
  async showForum(forum) {
    while (true) {
      const db = getDatabase();
      const messages = db.prepare(`
        SELECT m.*, u.username
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.forum_id = ? AND m.reply_to IS NULL
        ORDER BY m.created_at DESC
        LIMIT 50
      `).all(forum.id);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText(`Forum: ${forum.name}`, 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');

      if (messages.length === 0) {
        this.connection.write(colorText('No messages in this forum.', 'white') + '\r\n\r\n');
      } else {
        messages.forEach((msg, idx) => {
          const replyCount = db.prepare('SELECT COUNT(*) as count FROM messages WHERE reply_to = ?').get(msg.id).count;
          const date = new Date(msg.created_at).toLocaleDateString();

          this.connection.write(
            colorText(`[${idx + 1}] `, 'green', null, true) +
            colorText(msg.subject, 'white') +
            colorText(` - by ${msg.username} on ${date}`, 'cyan') +
            (replyCount > 0 ? colorText(` (${replyCount} replies)`, 'yellow') : '') +
            '\r\n'
          );
        });
      }

      this.connection.write('\r\n');
      this.connection.write(colorText('[R]ead  [P]ost  [Q]uit: ', 'yellow', null, true));

      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q') {
        return;
      } else if (choice === 'P') {
        await this.postMessage(forum);
      } else if (choice === 'R') {
        const msgNum = await this.connection.getInput('Message number: ');
        const idx = parseInt(msgNum) - 1;
        if (idx >= 0 && idx < messages.length) {
          await this.readMessage(messages[idx], forum);
        }
      }
    }
  }

  /**
   * Read a message
   */
  async readMessage(message, forum) {
    const db = getDatabase();

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');
    this.connection.write(colorText(`Subject: ${message.subject}`, 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(`From: ${message.username}`, 'white') + '\r\n');
    this.connection.write(colorText(`Date: ${new Date(message.created_at).toLocaleString()}`, 'white') + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');
    this.connection.write(wordWrap(message.body) + '\r\n\r\n');

    // Show replies
    const replies = db.prepare(`
      SELECT * FROM messages
      WHERE reply_to = ?
      ORDER BY created_at
    `).all(message.id);

    if (replies.length > 0) {
      this.connection.write(colorText('- Replies -', 'cyan', null, true) + '\r\n\r\n');
      replies.forEach((reply, idx) => {
        this.connection.write(colorText(`[${idx + 1}] ${reply.username} - ${new Date(reply.created_at).toLocaleString()}`, 'green') + '\r\n');
        this.connection.write(wordWrap(reply.body) + '\r\n\r\n');
      });
    }

    this.connection.write(colorText('[R]eply  [Q]uit: ', 'yellow', null, true));
    const choice = (await this.connection.getInput()).toUpperCase();

    if (choice === 'R') {
      await this.replyToMessage(message, forum);
    }
  }

  /**
   * Post new message
   */
  async postMessage(forum) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('POST NEW MESSAGE', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n\r\n');

    const subject = await this.connection.getInput('Subject: ');
    if (!subject) return;
    this.connection.write('\r\n');

    this.connection.write('\r\nEnter message body (type . on a line by itself to end):\r\n\r\n');

    const body = await this.getMultiLineInput();
    if (!body) return;

    const db = getDatabase();
    db.prepare(`
      INSERT INTO messages (forum_id, user_id, username, subject, body)
      VALUES (?, ?, ?, ?, ?)
    `).run(forum.id, this.user.id, this.user.username, subject, body);

    // Update forum post count
    db.prepare('UPDATE forums SET post_count = post_count + 1 WHERE id = ?').run(forum.id);

    // Update user post count
    this.user.incrementPosts();

    this.screen.messageBox('Success', 'Message posted successfully!', 'success');
    await this.connection.getChar();
  }

  /**
   * Reply to message
   */
  async replyToMessage(originalMessage, forum) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('REPLY TO MESSAGE', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n\r\n');

    this.connection.write('\r\nEnter your reply (type . on a line by itself to end):\r\n\r\n');

    const body = await this.getMultiLineInput();
    if (!body) return;

    const db = getDatabase();
    db.prepare(`
      INSERT INTO messages (forum_id, user_id, username, subject, body, reply_to)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(forum.id, this.user.id, this.user.username, 'Re: ' + originalMessage.subject, body, originalMessage.id);

    // Update forum post count
    db.prepare('UPDATE forums SET post_count = post_count + 1 WHERE id = ?').run(forum.id);

    // Update user post count
    this.user.incrementPosts();

    this.screen.messageBox('Success', 'Reply posted successfully!', 'success');
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

export default ForumService;
