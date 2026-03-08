/**
 * DOOR Game Service
 */
import getDatabase from '../database/db.js';
import { colorText } from '../utils/ansi.js';
import config from '../config/index.js';
import { spawn } from 'child_process';
import { existsSync } from 'fs';
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
   * Run a door game
   */
  async runDoor(door) {
    // Show door description
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');
    this.connection.write(colorText(door.name, 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');
    if (door.description) {
      this.connection.write(door.description + '\r\n\r\n');
    }

    this.connection.write(colorText('Starting game...', 'green', null, true) + '\r\n\r\n');

    // Check if command exists
    const doorPath = door.working_dir || config.paths.doors;
    const fullCommand = join(doorPath, door.command);

    if (!existsSync(fullCommand) && !existsSync(door.command)) {
      this.screen.messageBox('Error', `Door executable not found: ${door.command}`, 'error');
      await this.connection.getChar();
      return;
    }

    try {
      await this.executeDoor(door);

      // Update play count
      const db = getDatabase();
      db.prepare('UPDATE doors SET times_played = times_played + 1 WHERE id = ?').run(door.id);

      this.connection.write('\r\n\r\n');
      this.connection.write(colorText('Game ended. Press any key to continue...', 'yellow', null, true) + '\r\n');
      await this.connection.getChar();
    } catch (error) {
      this.screen.messageBox('Error', `Failed to run door: ${error.message}`, 'error');
      await this.connection.getChar();
    }
  }

  /**
   * Execute door game process
   */
  async executeDoor(door) {
    return new Promise((resolve, reject) => {
      // Create drop file for door (DOOR32.SYS format)
      const dropFile = this.createDropFile(door);

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
   * Create drop file for door (basic implementation)
   */
  createDropFile(door) {
    // This is a simplified drop file format
    // Real implementation would create DOOR32.SYS, DORINFO1.DEF, etc.
    const dropContent = {
      user: this.user.username,
      userId: this.user.id,
      securityLevel: this.user.security_level,
      timeOnline: Math.floor(this.connection.session.getDuration() / 60),
      bbsName: config.bbs.name,
    };

    return dropContent;
  }
}

export default DoorService;
