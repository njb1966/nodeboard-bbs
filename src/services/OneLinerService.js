/**
 * OneLiners / Graffiti Wall Service
 */
import getDatabase from '../database/db.js';
import { colorText, BOX, ANSI } from '../utils/ansi.js';

export class OneLinerService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show the OneLiners / Graffiti Wall
   */
  async show() {
    while (true) {
      this.screen.clear();
      this.connection.write('\r\n');

      // Header
      const title = ' OneLiners / Graffiti Wall ';
      const headerLine = BOX.D_HORIZONTAL.repeat(26) + title + BOX.D_HORIZONTAL.repeat(28);
      this.connection.write(colorText(headerLine, 'cyan', null, true) + '\r\n');
      this.connection.write('\r\n');

      // Fetch last 15 oneliners
      const db = getDatabase();
      const oneliners = db.prepare(`
        SELECT username, message, created_at
        FROM oneliners
        ORDER BY created_at DESC
        LIMIT 15
      `).all();

      if (oneliners.length === 0) {
        this.connection.write(colorText('  No oneliners yet. Be the first to write one!', 'white') + '\r\n');
      } else {
        // Display in chronological order (oldest first)
        for (const entry of oneliners.reverse()) {
          const date = new Date(entry.created_at);
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
            'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          const dateStr = `${monthNames[date.getMonth()]} ${date.getDate()}`;

          const userTag = colorText(` <${entry.username}> `, 'green', null, true);
          const msgText = colorText(entry.message, 'white');
          const dateTag = colorText(`[${dateStr}]`, 'black', null, true);  // bright black = gray/dim

          this.connection.write(userTag + msgText + '  ' + dateTag + '\r\n');
        }
      }

      // Separator
      this.connection.write('\r\n');
      this.connection.write(colorText(BOX.HORIZONTAL.repeat(80), 'cyan') + '\r\n');
      this.connection.write(colorText('  [W]rite a OneLiner  [Q]uit: ', 'yellow', null, true));

      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q') {
        return;
      } else if (choice === 'W') {
        await this.writeOneLiner();
      }
    }
  }

  /**
   * Prompt user to write a new oneliner
   */
  async writeOneLiner() {
    this.connection.write('\r\n');
    this.connection.write(colorText('  Enter your oneliner (max 75 chars): ', 'cyan'));

    const message = await this.connection.getInput();

    if (!message || message.trim().length === 0) {
      return;
    }

    // Truncate to 75 characters
    const trimmed = message.substring(0, 75);

    const db = getDatabase();
    db.prepare(`
      INSERT INTO oneliners (user_id, username, message)
      VALUES (?, ?, ?)
    `).run(this.user.id, this.user.username, trimmed);
  }
}

export default OneLinerService;
