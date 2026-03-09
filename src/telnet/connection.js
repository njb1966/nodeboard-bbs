/**
 * Telnet Connection Handler
 */
import { BBSScreen } from '../utils/screen.js';
import { ANSI, colorText } from '../utils/ansi.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { MainMenu } from '../services/menus/MainMenu.js';
import { LoginSequence } from '../services/LoginSequence.js';
import { removeFromAllRooms } from '../services/ChatRoomManager.js';
import { isLocked, isBanned, getRemainingLockout, recordFailedLogin, recordSuccessfulLogin } from '../services/RateLimiter.js';
import { AchievementService } from '../services/AchievementService.js';
import config from '../config/index.js';

export class TelnetConnection {
  /**
   * @param {import('net').Socket|import('stream').Duplex} socket - TCP socket or SSH channel
   * @param {string} remoteAddress
   * @param {object} [options]
   * @param {'telnet'|'ssh'} [options.protocol='telnet']
   * @param {import('../models/User.js').User|null} [options.user=null] - Pre-authenticated user (SSH)
   */
  constructor(socket, remoteAddress, options = {}) {
    this.socket = socket;
    this.remoteAddress = remoteAddress;
    this.protocol = options.protocol || 'telnet';
    this.screen = new BBSScreen(socket);
    this.user = options.user || null;
    this.session = null;
    this.inputBuffer = '';
    this.inputMode = 'line'; // 'line' or 'char'
    this.inputCallback = null;
    this.currentMenu = null;
    this.connectTime = new Date();

    // Node numbering (assigned by server after construction)
    this.nodeNumber = null;

    // Activity tracking
    this.activity = 'Logging in';

    // Chat / paging support
    this.chatPartner = null;
    this.pageQueue = [];
    this.chatMessageHandler = null;

    // Telnet negotiation (skip for SSH)
    if (this.protocol === 'telnet') {
      this.setupTelnet();
    }

    // Handle incoming data
    this.socket.on('data', (data) => this.handleData(data));
  }

  /**
   * Setup telnet options
   */
  setupTelnet() {
    // Send telnet options
    // IAC WILL ECHO - server will echo
    this.socket.write(Buffer.from([255, 251, 1]));
    // IAC WILL SUPPRESS_GO_AHEAD
    this.socket.write(Buffer.from([255, 251, 3]));
    // IAC DO TERMINAL_TYPE
    this.socket.write(Buffer.from([255, 253, 24]));
  }

  /**
   * Start the connection.
   * For SSH connections with a pre-authenticated user, skip the login flow.
   */
  async start() {
    if (this.protocol === 'ssh' && this.user) {
      // SSH: user already authenticated at the transport layer
      this.user.updateLastLogin();
      this.session = Session.create(this.user.id, this.user.username, this.remoteAddress);

      this.screen.welcomeScreen(config.bbs.name, config.bbs.version);
      this.screen.messageBox('Welcome', `Welcome back, ${this.user.username}!`, 'success');
      await this.getChar();

      // Check and award achievements on login
      const sshAchievements = AchievementService.checkAndAward(this.user);
      if (sshAchievements.length > 0) {
        AchievementService.notifyUnlocks(this, sshAchievements);
        await this.getChar();
      }

      this.setActivity('Main Menu');

      const loginSeq = new LoginSequence(this);
      await loginSeq.show();
      await this.mainMenu();
      return;
    }

    this.screen.welcomeScreen(config.bbs.name, config.bbs.version);
    await this.login();
  }

  /**
   * Handle incoming data
   */
  handleData(data) {
    // Filter out telnet commands (not needed for SSH)
    let filtered;
    if (this.protocol === 'telnet') {
      filtered = this.filterTelnetCommands(data);
      if (filtered.length === 0) return;
    } else {
      filtered = Buffer.isBuffer(data) ? data : Buffer.from(data);
      if (filtered.length === 0) return;
    }

    // Convert to string
    const input = filtered.toString('utf8');

    // Handle based on input mode
    if (this.inputMode === 'char') {
      // Character mode - immediate callback
      if (this.inputCallback) {
        this.inputCallback(input);
      }
    } else {
      // Line mode - buffer until newline
      for (const char of input) {
        if (char === '\r' || char === '\n') {
          // Always trigger callback on ENTER, even with empty buffer
          const line = this.inputBuffer.trim();
          this.inputBuffer = '';

          if (this.inputCallback) {
            this.inputCallback(line);
          }
        } else if (char === '\b' || char === '\x7f') {
          // Backspace
          if (this.inputBuffer.length > 0) {
            this.inputBuffer = this.inputBuffer.slice(0, -1);
            this.socket.write('\b \b'); // Erase character on screen
          }
        } else if (char.charCodeAt(0) >= 32 && char.charCodeAt(0) < 127) {
          // Printable character
          this.inputBuffer += char;
          this.socket.write(char); // Echo
        }
      }
    }
  }

  /**
   * Filter out telnet IAC commands
   */
  filterTelnetCommands(data) {
    const filtered = [];
    let i = 0;

    while (i < data.length) {
      if (data[i] === 255) { // IAC
        if (i + 1 < data.length) {
          const cmd = data[i + 1];
          if (cmd >= 251 && cmd <= 254) { // WILL/WONT/DO/DONT
            i += 3; // Skip IAC + cmd + option
            continue;
          } else if (cmd === 250) { // SB (subnegotiation)
            // Find SE (240)
            while (i < data.length && data[i] !== 240) i++;
            i++;
            continue;
          }
        }
        i += 2;
      } else {
        filtered.push(data[i]);
        i++;
      }
    }

    return Buffer.from(filtered);
  }

  /**
   * Get input from user
   */
  async getInput(prompt = '', echo = true) {
    return new Promise((resolve) => {
      if (prompt) {
        this.screen.prompt(prompt);
      }

      this.inputMode = 'line';
      this.inputCallback = (input) => {
        this.inputCallback = null;
        if (!echo) {
          this.write('\r\n');
        }
        resolve(input);
      };
    });
  }

  /**
   * Get single character input
   */
  async getChar() {
    return new Promise((resolve) => {
      this.inputMode = 'char';
      this.inputCallback = (char) => {
        this.inputCallback = null;
        this.inputMode = 'line';
        resolve(char);
      };
    });
  }

  /**
   * Write to socket
   */
  write(text) {
    this.socket.write(text);
  }

  /**
   * Login process
   */
  async login() {
    // Check IP ban before anything else
    if (isBanned(this.remoteAddress)) {
      this.write(colorText('\r\nYour IP has been banned.\r\n', 'red'));
      this.socket.end();
      return;
    }

    // Check IP lockout from too many failed attempts
    if (isLocked(this.remoteAddress)) {
      const remaining = getRemainingLockout(this.remoteAddress);
      const minutes = Math.ceil(remaining / 60);
      this.write(colorText(`\r\nToo many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.\r\n`, 'red'));
      this.socket.end();
      return;
    }

    let attempts = 0;
    const maxAttempts = config.security.maxLoginAttempts;

    while (attempts < maxAttempts) {
      this.write('\r\n');
      const username = await this.getInput('Username (or NEW for new account): ');

      if (!username) {
        attempts++;
        continue;
      }

      if (username.toUpperCase() === 'NEW') {
        if (config.features.allowNewUsers) {
          await this.newUserSignup();
          return;
        } else {
          this.screen.messageBox('Error', 'New user registration is currently disabled.', 'error');
          await this.getChar();
          continue;
        }
      }

      this.write('\r\n');
      const password = await this.getInput('Password: ', false);

      const user = User.findByUsername(username);

      if (user && await user.verifyPassword(password)) {
        // Check max sessions per user
        const activeSessions = Session.getActiveByUserId(user.id);
        if (activeSessions >= config.session.maxPerUser) {
          this.screen.messageBox('Error', 'You already have the maximum number of active sessions. Please disconnect from another session first.', 'error');
          await this.getChar();
          this.socket.end();
          return;
        }

        recordSuccessfulLogin(this.remoteAddress);

        this.user = user;
        user.updateLastLogin();

        // Create session
        this.session = Session.create(user.id, user.username, this.remoteAddress);

        this.screen.messageBox('Welcome', `Welcome back, ${user.username}!`, 'success');
        await this.getChar();

        // Check and award achievements on login
        const newAchievements = AchievementService.checkAndAward(user);
        if (newAchievements.length > 0) {
          AchievementService.notifyUnlocks(this, newAchievements);
          await this.getChar();
        }

        this.setActivity('Main Menu');

        // Run login sequence then enter main menu
        const loginSeq = new LoginSequence(this);
        await loginSeq.show();
        await this.mainMenu();
        return;
      } else {
        attempts++;
        recordFailedLogin(this.remoteAddress);

        // Re-check if now locked out
        if (isLocked(this.remoteAddress)) {
          const remaining = getRemainingLockout(this.remoteAddress);
          const minutes = Math.ceil(remaining / 60);
          this.write(colorText(`\r\nToo many failed attempts. Try again in ${minutes} minute${minutes !== 1 ? 's' : ''}.\r\n`, 'red'));
          this.socket.end();
          return;
        }

        this.screen.messageBox('Error', `Invalid username or password. ${maxAttempts - attempts} attempts remaining.`, 'error');
        await this.getChar();
      }
    }

    this.write(colorText('\r\nToo many failed login attempts. Goodbye.\r\n', 'red'));
    this.socket.end();
  }

  /**
   * New user signup
   */
  async newUserSignup() {
    this.screen.clear();
    this.write(colorText('═'.repeat(80), 'cyan', null, true) + '\r\n');
    this.write(colorText('NEW USER REGISTRATION', 'yellow', null, true) + '\r\n');
    this.write(colorText('═'.repeat(80), 'cyan', null, true) + '\r\n\r\n');

    const username = await this.getInput('Choose a username: ');
    if (!username || username.length < 3) {
      this.screen.messageBox('Error', 'Username must be at least 3 characters.', 'error');
      await this.getChar();
      await this.login();
      return;
    }

    this.write('\r\n');
    const password = await this.getInput('Choose a password: ', false);
    if (!password || password.length < config.security.passwordMinLength) {
      this.screen.messageBox('Error', `Password must be at least ${config.security.passwordMinLength} characters.`, 'error');
      await this.getChar();
      await this.login();
      return;
    }

    this.write('\r\n');
    const passwordConfirm = await this.getInput('Confirm password: ', false);
    if (password !== passwordConfirm) {
      this.screen.messageBox('Error', 'Passwords do not match.', 'error');
      await this.getChar();
      await this.login();
      return;
    }

    this.write('\r\n');
    const email = await this.getInput('Email (optional): ');
    this.write('\r\n');
    const realName = await this.getInput('Real name (optional): ');

    try {
      this.user = await User.create(username, password, email || null, realName || null);
      this.user.updateLastLogin();

      // Create session
      this.session = Session.create(this.user.id, this.user.username, this.remoteAddress);

      this.screen.messageBox('Success', 'Your account has been created successfully!', 'success');
      await this.getChar();

      // Check and award achievements on first login
      const newUserAchievements = AchievementService.checkAndAward(this.user);
      if (newUserAchievements.length > 0) {
        AchievementService.notifyUnlocks(this, newUserAchievements);
        await this.getChar();
      }

      this.setActivity('Main Menu');

      // Run login sequence then enter main menu
      const loginSeq = new LoginSequence(this);
      await loginSeq.show();
      await this.mainMenu();
    } catch (error) {
      this.screen.messageBox('Error', error.message, 'error');
      await this.getChar();
      await this.login();
    }
  }

  /**
   * Main menu
   */
  async mainMenu() {
    const menu = new MainMenu(this);
    await menu.show();
  }

  /**
   * Update the current activity string (shown in Who's Online)
   * @param {string} activity
   */
  setActivity(activity) {
    this.activity = activity;
  }

  /**
   * Check if authenticated
   */
  isAuthenticated() {
    return this.user !== null;
  }

  /**
   * Cleanup on disconnect
   */
  cleanup() {
    // Remove from any chat rooms the user was in
    removeFromAllRooms(this);

    if (this.session) {
      // Update time online
      const duration = Math.floor((Date.now() - this.connectTime.getTime()) / 1000);
      if (this.user) {
        this.user.updateTimeOnline(duration);
      }

      this.session.end();
    }
  }
}

export default TelnetConnection;
