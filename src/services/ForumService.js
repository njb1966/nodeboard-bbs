/**
 * Forum/Message Board Service
 */
import getDatabase from '../database/db.js';
import { colorText } from '../utils/ansi.js';
import { wordWrap } from '../utils/text.js';
import { loadMenu } from './menus/MenuLoader.js';
import { AchievementService } from './AchievementService.js';

export class ForumService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show forum list
   *
   * Uses the forums.json menu config for title/prompt, but builds items
   * dynamically from the database since forum lists vary per installation.
   */
  async show() {
    const menuDef = loadMenu('forums');

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

      // Append static items from the menu config (e.g., "Q - Return to Main Menu")
      menuItems.push(...menuDef.items);

      this.screen.menu(menuDef.title, menuItems, menuDef.prompt || 'Forum');

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

    // Check for post-related achievements
    const newAch = AchievementService.checkAndAward(this.user);
    if (newAch.length > 0) {
      AchievementService.notifyUnlocks(this.connection, newAch);
    }

    this.screen.messageBox('Success', 'Message posted successfully!', 'success');
    await this.connection.getChar();
  }

  /**
   * Reply to message (with quoting)
   */
  async replyToMessage(originalMessage, forum) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('REPLY TO MESSAGE', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n\r\n');

    // Build quoted text from original message
    const quoteDate = new Date(originalMessage.created_at).toLocaleString();
    const quoteHeader = `On ${quoteDate}, ${originalMessage.username} wrote:`;
    const quotedLines = [quoteHeader];
    const originalLines = originalMessage.body.split('\n');
    for (const line of originalLines) {
      quotedLines.push('> ' + line);
    }
    quotedLines.push('');  // blank line separator before new text

    // Show quoted text to the user
    this.connection.write(colorText('Quoted text included:', 'cyan') + '\r\n');
    quotedLines.forEach((line, idx) => {
      this.connection.write(colorText(`${idx + 1}: `, 'green') + line + '\r\n');
    });

    this.connection.write('\r\nEnter your reply below (type . on a line by itself to end):\r\n\r\n');

    const body = await this.getMultiLineInput(quotedLines);
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

    // Check for post-related achievements
    const replyAch = AchievementService.checkAndAward(this.user);
    if (replyAch.length > 0) {
      AchievementService.notifyUnlocks(this.connection, replyAch);
    }

    this.screen.messageBox('Success', 'Reply posted successfully!', 'success');
    await this.connection.getChar();
  }

  /**
   * Get multi-line input
   * @param {string[]} [prefill] - Optional array of lines to pre-populate
   */
  async getMultiLineInput(prefill = null) {
    const lines = prefill ? [...prefill] : [];
    let lineNum = lines.length + 1;

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

  /**
   * New message scan - find messages posted since user's last login
   */
  async newScan() {
    const db = getDatabase();

    // Get user's last login timestamp
    const userRow = db.prepare('SELECT last_login FROM users WHERE id = ?').get(this.user.id);
    const lastLogin = userRow.last_login || '1970-01-01T00:00:00';

    // Get all forums the user has access to
    const forums = db.prepare(`
      SELECT * FROM forums
      WHERE security_level <= ?
      ORDER BY id
    `).all(this.user.security_level);

    // Count new messages per forum
    const forumsWithNew = [];
    let totalNew = 0;

    for (const forum of forums) {
      const result = db.prepare(`
        SELECT COUNT(*) as count FROM messages
        WHERE forum_id = ? AND created_at > ?
      `).get(forum.id, lastLogin);

      if (result.count > 0) {
        forumsWithNew.push({ forum, count: result.count });
        totalNew += result.count;
      }
    }

    // Display scan results
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('New Message Scan', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('─'.repeat(40), 'cyan') + '\r\n');

    if (totalNew === 0) {
      this.connection.write(colorText('No new messages since your last login.', 'white') + '\r\n\r\n');
      this.connection.write(colorText('Press any key to continue...', 'cyan'));
      await this.connection.getChar();
      return;
    }

    for (const entry of forumsWithNew) {
      const label = entry.forum.name + ':';
      const msgText = entry.count === 1 ? '1 new message' : `${entry.count} new messages`;
      this.connection.write(
        colorText(label.padEnd(25), 'white') +
        colorText(msgText, 'green') + '\r\n'
      );
    }

    this.connection.write(colorText('─'.repeat(40), 'cyan') + '\r\n');
    this.connection.write(
      colorText(`Total: ${totalNew} new message${totalNew === 1 ? '' : 's'} across ${forumsWithNew.length} forum${forumsWithNew.length === 1 ? '' : 's'}`, 'yellow', null, true) + '\r\n\r\n'
    );

    this.connection.write(colorText('[R]ead new messages  [Q]uit: ', 'yellow', null, true));
    const choice = (await this.connection.getInput()).toUpperCase();

    if (choice === 'R') {
      await this.readNewMessages(forumsWithNew, lastLogin);
    }
  }

  /**
   * Read new messages across forums
   */
  async readNewMessages(forumsWithNew, lastLogin) {
    const db = getDatabase();

    for (const entry of forumsWithNew) {
      const messages = db.prepare(`
        SELECT m.*, u.username
        FROM messages m
        JOIN users u ON m.user_id = u.id
        WHERE m.forum_id = ? AND m.created_at > ?
        ORDER BY m.created_at
      `).all(entry.forum.id, lastLogin);

      for (let i = 0; i < messages.length; i++) {
        const message = messages[i];

        this.screen.clear();
        this.connection.write('\r\n');
        this.connection.write(colorText(`Forum: ${entry.forum.name}`, 'cyan', null, true) +
          colorText(` (${i + 1} of ${messages.length})`, 'white') + '\r\n');
        this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');
        this.connection.write(colorText(`Subject: ${message.subject}`, 'yellow', null, true) + '\r\n');
        this.connection.write(colorText(`From: ${message.username}`, 'white') + '\r\n');
        this.connection.write(colorText(`Date: ${new Date(message.created_at).toLocaleString()}`, 'white') + '\r\n');
        this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');
        this.connection.write(wordWrap(message.body) + '\r\n\r\n');

        this.connection.write(colorText('[N]ext  [R]eply  [Q]uit: ', 'yellow', null, true));
        const action = (await this.connection.getInput()).toUpperCase();

        if (action === 'Q') {
          return;
        } else if (action === 'R') {
          await this.replyToMessage(message, entry.forum);
        }
        // 'N' or anything else continues to next message
      }
    }

    this.connection.write('\r\n' + colorText('No more new messages.', 'yellow') + '\r\n');
    this.connection.write(colorText('Press any key to continue...', 'cyan'));
    await this.connection.getChar();
  }
}

export default ForumService;
