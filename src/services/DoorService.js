/**
 * DOOR Game Service
 *
 * Manages external door games with proper DOOR32.SYS drop file generation
 * and per-user time bank tracking.
 */
import getDatabase from '../database/db.js';
import { colorText } from '../utils/ansi.js';
import { logEvent } from './LogService.js';
import config from '../config/index.js';
import { spawn } from 'child_process';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

export class DoorService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show door games menu
   */
  async show() {
    const db = getDatabase();
    const doors = db.prepare(`
      SELECT * FROM doors
      WHERE enabled = 1 AND security_level <= ?
      ORDER BY name
    `).all(this.user.security_level);

    if (doors.length === 0) {
      this.screen.messageBox('Info', 'No door games are currently available.', 'info');
      await this.connection.getChar();
      return;
    }

    while (true) {
      const menuItems = doors.map((door, idx) => ({
        key: (idx + 1).toString(),
        text: `${door.name} (played ${door.times_played} times)`,
      }));

      menuItems.push({ key: 'Q', text: 'Return to Main Menu' });

      this.screen.menu('DOOR GAMES', menuItems, 'Game');

      const choice = await this.connection.getInput();

      if (choice.toUpperCase() === 'Q') {
        return;
      }

      const doorIdx = parseInt(choice) - 1;
      if (doorIdx >= 0 && doorIdx < doors.length) {
        await this.runDoor(doors[doorIdx]);
      }
    }
  }

  /**
   * Get the user's remaining door time bank (in minutes).
   */
  getTimeBank() {
    const db = getDatabase();
    const row = db.prepare('SELECT door_time_bank FROM users WHERE id = ?').get(this.user.id);
    return row ? row.door_time_bank : 0;
  }

  /**
   * Deduct time from the user's door time bank.
   * @param {number} minutes - Minutes to deduct
   */
  deductTime(minutes) {
    const db = getDatabase();
    db.prepare('UPDATE users SET door_time_bank = MAX(0, door_time_bank - ?) WHERE id = ?')
      .run(minutes, this.user.id);
  }

  /**
   * Run a door game
   */
  async runDoor(door) {
    // Check time bank
    const timeRemaining = this.getTimeBank();
    if (timeRemaining <= 0) {
      this.screen.messageBox('Error', 'You have no time remaining in your door game time bank.', 'error');
      await this.connection.getChar();
      return;
    }

    // Show door description
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');
    this.connection.write(colorText(door.name, 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');
    if (door.description) {
      this.connection.write(door.description + '\r\n\r\n');
    }

    this.connection.write(colorText(`Time remaining: ${timeRemaining} minutes`, 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('Starting game...', 'green', null, true) + '\r\n\r\n');

    // Check if command exists
    const doorPath = door.working_dir || config.paths.doors;
    const fullCommand = join(doorPath, door.command);

    if (!existsSync(fullCommand) && !existsSync(door.command)) {
      this.screen.messageBox('Error', `Door executable not found: ${door.command}`, 'error');
      await this.connection.getChar();
      return;
    }

    const startTime = Date.now();

    try {
      await this.executeDoor(door, timeRemaining);

      // Calculate time used and deduct
      const minutesUsed = Math.ceil((Date.now() - startTime) / 60000);
      this.deductTime(minutesUsed);

      // Update play count
      const db = getDatabase();
      db.prepare('UPDATE doors SET times_played = times_played + 1 WHERE id = ?').run(door.id);
      logEvent('SYSTEM', this.user.id, this.user.username, `Played door game: ${door.name} (${minutesUsed} min)`, this.connection.remoteAddress);

      this.connection.write('\r\n\r\n');
      this.connection.write(colorText(`Game ended. Used ${minutesUsed} minute${minutesUsed !== 1 ? 's' : ''}.`, 'cyan') + '\r\n');
      this.connection.write(colorText('Press any key to continue...', 'yellow', null, true) + '\r\n');
      await this.connection.getChar();
    } catch (error) {
      // Still deduct time even on error
      const minutesUsed = Math.ceil((Date.now() - startTime) / 60000);
      if (minutesUsed > 0) {
        this.deductTime(minutesUsed);
      }
      this.screen.messageBox('Error', `Failed to run door: ${error.message}`, 'error');
      await this.connection.getChar();
    }
  }

  /**
   * Execute door game process
   */
  async executeDoor(door, timeMinutes) {
    return new Promise((resolve, reject) => {
      // Create DOOR32.SYS drop file
      const dropFilePath = this.createDropFile(door, timeMinutes);

      // Spawn door process
      const doorPath = door.working_dir || config.paths.doors;
      const args = door.command.split(' ');
      const command = args.shift();

      const proc = spawn(command, args, {
        cwd: doorPath,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          ...process.env,
          BBSUSER: this.user.username,
          BBSUID: this.user.id.toString(),
          DROPFILE: dropFilePath,
        },
      });

      // Pipe door output to socket
      proc.stdout.on('data', (data) => {
        this.connection.socket.write(data);
      });

      proc.stderr.on('data', (data) => {
        console.error(`Door stderr: ${data}`);
      });

      // Pipe socket input to door
      const dataHandler = (data) => {
        proc.stdin.write(data);
      };

      this.connection.socket.on('data', dataHandler);

      proc.on('close', (code) => {
        this.connection.socket.removeListener('data', dataHandler);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`Door exited with code ${code}`));
        }
      });

      proc.on('error', (err) => {
        this.connection.socket.removeListener('data', dataHandler);
        reject(err);
      });
    });
  }

  /**
   * Create DOOR32.SYS drop file.
   *
   * Format (one value per line):
   *   0            Comm type: 0 = local
   *   0            Comm handle (socket handle)
   *   38400        Baud rate
   *   BBS Name     BBS software name
   *   1            User record number (user ID)
   *   Real Name    User's real name
   *   Username     User's alias / handle
   *   99           Security level
   *   30           Time remaining in minutes
   *   1            ANSI emulation: 1 = yes
   *   1            Node number
   *
   * @returns {string} Path to the generated drop file
   */
  createDropFile(door, timeMinutes) {
    const doorPath = door.working_dir || config.paths.doors;
    const dropDir = join(doorPath, 'temp');
    if (!existsSync(dropDir)) {
      mkdirSync(dropDir, { recursive: true });
    }

    const nodeNumber = this.connection.nodeNumber || 1;
    const realName = this.user.real_name || this.user.username;

    const lines = [
      '0',                          // Comm type: 0 = local
      '0',                          // Comm handle
      '38400',                      // Baud rate
      config.bbs.name,              // BBS name
      String(this.user.id),         // User record number
      realName,                     // User's real name
      this.user.username,           // User's alias
      String(this.user.security_level), // Security level
      String(timeMinutes),          // Time remaining in minutes
      '1',                          // ANSI emulation: 1 = yes
      String(nodeNumber),           // Node number
    ];

    const dropFilePath = join(dropDir, `DOOR32.SYS`);
    writeFileSync(dropFilePath, lines.join('\r\n') + '\r\n');

    return dropFilePath;
  }
}

export default DoorService;
