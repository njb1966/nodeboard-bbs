/**
 * Voting/Polls Service
 */
import getDatabase from '../database/db.js';
import { colorText, BOX } from '../utils/ansi.js';
import { AchievementService } from './AchievementService.js';

export class PollService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Main polls menu loop
   */
  async show() {
    while (true) {
      const db = getDatabase();
      const polls = db.prepare(`
        SELECT p.*,
          (SELECT COUNT(*) FROM poll_votes WHERE poll_id = p.id) as vote_count
        FROM polls p
        WHERE p.is_active = 1
          AND p.security_level <= ?
        ORDER BY p.created_at DESC
      `).all(this.user.security_level);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('VOTING BOOTH', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText(BOX.HORIZONTAL.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      if (polls.length === 0) {
        this.connection.write(colorText('No active polls at this time.', 'white') + '\r\n\r\n');
      } else {
        polls.forEach((poll, idx) => {
          this.connection.write(
            colorText(`[${idx + 1}] `, 'green', null, true) +
            colorText(poll.question, 'white') +
            colorText(` (by ${poll.created_by_name}, ${poll.vote_count} votes)`, 'cyan') +
            '\r\n'
          );
        });
      }

      this.connection.write('\r\n');

      let promptParts = ['[#] Vote', '[C]reate Poll', '[R]esults', '[E]dit Poll', '[Q]uit'];
      if (this.user.security_level >= 90) {
        promptParts.splice(4, 0, '[D]elete Poll');
      }
      this.connection.write(colorText(promptParts.join('  '), 'yellow', null, true) + '\r\n');

      const choice = (await this.connection.getInput('Polls> ')).toUpperCase();

      if (choice === 'Q') {
        return;
      } else if (choice === 'C') {
        await this.createPoll();
      } else if (choice === 'R') {
        if (polls.length === 0) {
          this.screen.messageBox('Info', 'No polls to show results for.', 'info');
          await this.connection.getChar();
          continue;
        }
        const num = await this.connection.getInput('Poll number to view results: ');
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < polls.length) {
          await this.viewPoll(polls[idx].id);
        }
      } else if (choice === 'E') {
        if (polls.length === 0) {
          this.screen.messageBox('Info', 'No polls to edit.', 'info');
          await this.connection.getChar();
          continue;
        }
        const num = await this.connection.getInput('Poll number to edit: ');
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < polls.length) {
          const poll = polls[idx];
          const canEdit = poll.created_by === this.user.id || this.user.security_level >= 90;
          if (!canEdit) {
            this.screen.messageBox('Error', 'You can only edit polls you created.', 'error');
            await this.connection.getChar();
          } else {
            await this.editPoll(poll.id);
          }
        }
      } else if (choice === 'D' && this.user.security_level >= 90) {
        if (polls.length === 0) {
          this.screen.messageBox('Info', 'No polls to delete.', 'info');
          await this.connection.getChar();
          continue;
        }
        const num = await this.connection.getInput('Poll number to delete: ');
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < polls.length) {
          await this.deletePoll(polls[idx].id);
        }
      } else {
        const idx = parseInt(choice) - 1;
        if (idx >= 0 && polls && idx < polls.length) {
          await this.viewPoll(polls[idx].id);
        }
      }
    }
  }

  /**
   * Display a single poll with results and voting
   */
  async viewPoll(pollId) {
    const db = getDatabase();

    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
    if (!poll) return;

    const options = db.prepare(`
      SELECT po.*,
        (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count
      FROM poll_options po
      WHERE po.poll_id = ?
      ORDER BY po.sort_order, po.id
    `).all(pollId);

    const totalVotes = options.reduce((sum, opt) => sum + opt.vote_count, 0);

    const userVote = db.prepare(`
      SELECT pv.option_id FROM poll_votes pv
      WHERE pv.poll_id = ? AND pv.user_id = ?
    `).get(pollId, this.user.id);

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('POLL RESULTS', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(BOX.HORIZONTAL.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    this.connection.write(colorText('Question: ', 'white', null, true) + colorText(poll.question, 'cyan', null, true) + '\r\n');
    this.connection.write(colorText(BOX.HORIZONTAL.repeat(45), 'cyan') + '\r\n');

    const barWidth = 18;
    options.forEach((opt, idx) => {
      const pct = totalVotes > 0 ? Math.round((opt.vote_count / totalVotes) * 100) : 0;
      const bar = this.renderBar(pct, barWidth);
      const voted = userVote && userVote.option_id === opt.id ? ' *' : '';

      this.connection.write(
        colorText(`${idx + 1}. `, 'green', null, true) +
        colorText(opt.option_text.padEnd(20), 'white') +
        bar +
        colorText(` ${pct.toString().padStart(3)}% `, 'yellow') +
        colorText(`(${opt.vote_count})`, 'cyan') +
        colorText(voted, 'magenta', null, true) +
        '\r\n'
      );
    });

    this.connection.write(colorText(BOX.HORIZONTAL.repeat(45), 'cyan') + '\r\n');
    this.connection.write(colorText(`Total votes: ${totalVotes}`, 'white', null, true) + '\r\n\r\n');

    if (userVote) {
      const votedOption = options.find(o => o.id === userVote.option_id);
      this.connection.write(colorText(`You voted for: ${votedOption ? votedOption.option_text : 'Unknown'}`, 'magenta', null, true) + '\r\n\r\n');
      this.connection.write(colorText('Press any key to continue...', 'white'));
      await this.connection.getChar();
    } else {
      this.connection.write(colorText(`Select option [1-${options.length}] to vote, [Q]uit: `, 'yellow', null, true));
      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q') return;

      const optIdx = parseInt(choice) - 1;
      if (optIdx >= 0 && optIdx < options.length) {
        try {
          db.prepare(`
            INSERT INTO poll_votes (poll_id, option_id, user_id)
            VALUES (?, ?, ?)
          `).run(pollId, options[optIdx].id, this.user.id);

          // Check for voting achievement
          const voteAch = AchievementService.awardSingle(this.user, 'first_vote');
          if (voteAch) {
            AchievementService.notifyUnlock(this.connection, voteAch);
          }

          this.screen.messageBox('Success', 'Your vote has been recorded!', 'success');
          await this.connection.getChar();
        } catch (err) {
          this.screen.messageBox('Error', 'You have already voted on this poll.', 'error');
          await this.connection.getChar();
        }
      }
    }
  }

  /**
   * Create a new poll
   */
  async createPoll() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('CREATE NEW POLL', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(BOX.HORIZONTAL.repeat(80), 'cyan') + '\r\n\r\n');

    const question = await this.connection.getInput('Poll question: ');
    if (!question) return;

    this.connection.write('\r\n');
    this.connection.write(colorText('Enter options one at a time (blank line to finish, min 2, max 10):', 'white') + '\r\n\r\n');

    const options = [];
    for (let i = 1; i <= 10; i++) {
      const opt = await this.connection.getInput(`Option ${i}: `);
      this.connection.write('\r\n');

      if (!opt) {
        if (options.length < 2) {
          this.connection.write(colorText('You need at least 2 options. Keep going.\r\n', 'yellow'));
          i--; // retry this number
          continue;
        }
        break;
      }

      options.push(opt);
    }

    if (options.length < 2) {
      this.screen.messageBox('Error', 'Poll creation cancelled. Need at least 2 options.', 'error');
      await this.connection.getChar();
      return;
    }

    // Sysops can set security level
    let securityLevel = 10;
    if (this.user.security_level >= 90) {
      const levelInput = await this.connection.getInput('Security level (default 10): ');
      this.connection.write('\r\n');
      if (levelInput) {
        const parsed = parseInt(levelInput);
        if (!isNaN(parsed) && parsed >= 10 && parsed <= 99) {
          securityLevel = parsed;
        }
      }
    }

    const db = getDatabase();
    const result = db.prepare(`
      INSERT INTO polls (question, created_by, created_by_name, security_level)
      VALUES (?, ?, ?, ?)
    `).run(question, this.user.id, this.user.username, securityLevel);

    const pollId = result.lastInsertRowid;

    const insertOption = db.prepare(`
      INSERT INTO poll_options (poll_id, option_text, sort_order)
      VALUES (?, ?, ?)
    `);

    options.forEach((opt, idx) => {
      insertOption.run(pollId, opt, idx + 1);
    });

    this.screen.messageBox('Success', 'Poll created successfully!', 'success');
    await this.connection.getChar();
  }

  /**
   * Edit an existing poll (creator or sysop only)
   */
  async editPoll(pollId) {
    const db = getDatabase();

    while (true) {
      const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
      if (!poll) return;

      const options = db.prepare(`
        SELECT po.*,
          (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count
        FROM poll_options po
        WHERE po.poll_id = ?
        ORDER BY po.sort_order, po.id
      `).all(pollId);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('EDIT POLL', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText(BOX.HORIZONTAL.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      this.connection.write(colorText('Question: ', 'white', null, true) + colorText(poll.question, 'cyan', null, true) + '\r\n');
      this.connection.write(colorText('Status: ', 'white', null, true) + colorText(poll.is_active ? 'Active' : 'Inactive', poll.is_active ? 'green' : 'red', null, true) + '\r\n');
      this.connection.write(colorText('Security Level: ', 'white', null, true) + colorText(String(poll.security_level), 'yellow') + '\r\n');
      this.connection.write(colorText('Expires: ', 'white', null, true) + colorText(poll.expires_at || 'Never', 'yellow') + '\r\n\r\n');

      this.connection.write(colorText('Options:', 'white', null, true) + '\r\n');
      options.forEach((opt, idx) => {
        this.connection.write(
          colorText(`  ${idx + 1}. `, 'green', null, true) +
          colorText(opt.option_text, 'white') +
          colorText(` (${opt.vote_count} votes)`, 'cyan') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('[Q] Change Question  [O] Edit Options  [T] Toggle Active/Inactive', 'yellow', null, true) + '\r\n');
      let extraOpts = '[X] Set Expiry Date';
      if (this.user.security_level >= 90) {
        extraOpts += '  [S] Change Security Level';
      }
      extraOpts += '  [D] Done';
      this.connection.write(colorText(extraOpts, 'yellow', null, true) + '\r\n\r\n');

      const choice = (await this.connection.getInput('Edit> ')).toUpperCase();

      if (choice === 'D') {
        return;
      } else if (choice === 'Q') {
        await this._editQuestion(pollId, poll.question);
      } else if (choice === 'O') {
        await this._editOptions(pollId);
      } else if (choice === 'T') {
        const newState = poll.is_active ? 0 : 1;
        db.prepare('UPDATE polls SET is_active = ? WHERE id = ?').run(newState, pollId);
        this.screen.messageBox('Success', `Poll is now ${newState ? 'active' : 'inactive'}.`, 'success');
        await this.connection.getChar();
      } else if (choice === 'X') {
        await this._editExpiry(pollId);
      } else if (choice === 'S' && this.user.security_level >= 90) {
        await this._editSecurityLevel(pollId);
      }
    }
  }

  /**
   * Edit poll question
   */
  async _editQuestion(pollId, currentQuestion) {
    const db = getDatabase();
    this.connection.write('\r\n');
    this.connection.write(colorText(`Current question: ${currentQuestion}`, 'white') + '\r\n');
    const newQuestion = await this.connection.getInput('New question (blank to cancel): ');
    if (!newQuestion) return;

    db.prepare('UPDATE polls SET question = ? WHERE id = ?').run(newQuestion, pollId);
    this.screen.messageBox('Success', 'Question updated.', 'success');
    await this.connection.getChar();
  }

  /**
   * Edit poll options sub-menu
   */
  async _editOptions(pollId) {
    const db = getDatabase();

    while (true) {
      const options = db.prepare(`
        SELECT po.*,
          (SELECT COUNT(*) FROM poll_votes WHERE option_id = po.id) as vote_count
        FROM poll_options po
        WHERE po.poll_id = ?
        ORDER BY po.sort_order, po.id
      `).all(pollId);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('EDIT OPTIONS', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText(BOX.HORIZONTAL.repeat(80), 'cyan', null, true) + '\r\n\r\n');

      options.forEach((opt, idx) => {
        this.connection.write(
          colorText(`  ${idx + 1}. `, 'green', null, true) +
          colorText(opt.option_text, 'white') +
          colorText(` (${opt.vote_count} votes)`, 'cyan') +
          '\r\n'
        );
      });

      this.connection.write('\r\n');
      this.connection.write(colorText('[E]dit Option  [A]dd Option  [R]emove Option  [D]one', 'yellow', null, true) + '\r\n\r\n');

      const choice = (await this.connection.getInput('Options> ')).toUpperCase();

      if (choice === 'D') {
        return;
      } else if (choice === 'E') {
        const num = await this.connection.getInput(`Option number to edit [1-${options.length}]: `);
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < options.length) {
          this.connection.write(colorText(`Current text: ${options[idx].option_text}`, 'white') + '\r\n');
          const newText = await this.connection.getInput('New text (blank to cancel): ');
          if (newText) {
            db.prepare('UPDATE poll_options SET option_text = ? WHERE id = ?').run(newText, options[idx].id);
            this.screen.messageBox('Success', 'Option updated.', 'success');
            await this.connection.getChar();
          }
        }
      } else if (choice === 'A') {
        if (options.length >= 10) {
          this.screen.messageBox('Error', 'Maximum of 10 options reached.', 'error');
          await this.connection.getChar();
          continue;
        }
        const newText = await this.connection.getInput('New option text (blank to cancel): ');
        if (newText) {
          const maxOrder = options.length > 0 ? Math.max(...options.map(o => o.sort_order)) : 0;
          db.prepare('INSERT INTO poll_options (poll_id, option_text, sort_order) VALUES (?, ?, ?)').run(pollId, newText, maxOrder + 1);
          this.screen.messageBox('Success', 'Option added.', 'success');
          await this.connection.getChar();
        }
      } else if (choice === 'R') {
        if (options.length <= 2) {
          this.screen.messageBox('Error', 'A poll must have at least 2 options.', 'error');
          await this.connection.getChar();
          continue;
        }
        const num = await this.connection.getInput(`Option number to remove [1-${options.length}]: `);
        const idx = parseInt(num) - 1;
        if (idx >= 0 && idx < options.length) {
          if (options[idx].vote_count > 0) {
            this.screen.messageBox('Error', 'Cannot remove an option that has votes.', 'error');
            await this.connection.getChar();
          } else {
            this.connection.write(colorText(`Remove "${options[idx].option_text}"? (Y/N): `, 'yellow', null, true));
            const confirm = (await this.connection.getInput()).toUpperCase();
            if (confirm === 'Y') {
              db.prepare('DELETE FROM poll_options WHERE id = ?').run(options[idx].id);
              this.screen.messageBox('Success', 'Option removed.', 'success');
              await this.connection.getChar();
            }
          }
        }
      }
    }
  }

  /**
   * Edit poll expiry date
   */
  async _editExpiry(pollId) {
    const db = getDatabase();
    this.connection.write('\r\n');
    const dateInput = await this.connection.getInput('Expiry date (YYYY-MM-DD, blank to clear): ');
    if (dateInput === '') {
      db.prepare('UPDATE polls SET expires_at = NULL WHERE id = ?').run(pollId);
      this.screen.messageBox('Success', 'Expiry date cleared.', 'success');
      await this.connection.getChar();
      return;
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateInput)) {
      this.screen.messageBox('Error', 'Invalid date format. Use YYYY-MM-DD.', 'error');
      await this.connection.getChar();
      return;
    }

    const parsed = new Date(dateInput);
    if (isNaN(parsed.getTime())) {
      this.screen.messageBox('Error', 'Invalid date.', 'error');
      await this.connection.getChar();
      return;
    }

    db.prepare('UPDATE polls SET expires_at = ? WHERE id = ?').run(dateInput, pollId);
    this.screen.messageBox('Success', `Expiry set to ${dateInput}.`, 'success');
    await this.connection.getChar();
  }

  /**
   * Edit poll security level (sysop only)
   */
  async _editSecurityLevel(pollId) {
    const db = getDatabase();
    this.connection.write('\r\n');
    const levelInput = await this.connection.getInput('New security level (10-99): ');
    const parsed = parseInt(levelInput);
    if (isNaN(parsed) || parsed < 10 || parsed > 99) {
      this.screen.messageBox('Error', 'Invalid level. Must be 10-99.', 'error');
      await this.connection.getChar();
      return;
    }

    db.prepare('UPDATE polls SET security_level = ? WHERE id = ?').run(parsed, pollId);
    this.screen.messageBox('Success', `Security level set to ${parsed}.`, 'success');
    await this.connection.getChar();
  }

  /**
   * Delete a poll (sysop only)
   */
  async deletePoll(pollId) {
    const db = getDatabase();
    const poll = db.prepare('SELECT * FROM polls WHERE id = ?').get(pollId);
    if (!poll) return;

    this.connection.write('\r\n');
    this.connection.write(colorText(`Delete poll: "${poll.question}"? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();

    if (confirm !== 'Y') {
      this.screen.messageBox('Info', 'Action cancelled.', 'info');
      await this.connection.getChar();
      return;
    }

    db.prepare('DELETE FROM poll_votes WHERE poll_id = ?').run(pollId);
    db.prepare('DELETE FROM poll_options WHERE poll_id = ?').run(pollId);
    db.prepare('DELETE FROM polls WHERE id = ?').run(pollId);

    this.screen.messageBox('Success', 'Poll deleted.', 'success');
    await this.connection.getChar();
  }

  /**
   * Render a percentage bar
   * Returns a text bar like "████████░░░░░░░░"
   */
  renderBar(percentage, width) {
    const filled = Math.round((percentage / 100) * width);
    const empty = width - filled;
    return colorText('█'.repeat(filled), 'green', null, true) +
           colorText('░'.repeat(empty), 'white');
  }
}

export default PollService;
