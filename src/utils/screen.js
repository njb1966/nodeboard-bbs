/**
 * Screen buffer and rendering utilities
 */
import { ANSI, BOX, cursorTo, drawBox, centerText, padText, colorText, color } from './ansi.js';
import { getActiveTheme } from '../services/ThemeService.js';
import { loadArt } from './artloader.js';

export class Screen {
  constructor(width = 80, height = 24) {
    this.width = width;
    this.height = height;
    this.buffer = [];
    this.clear();
  }

  /**
   * Clear the screen buffer
   */
  clear() {
    this.buffer = Array(this.height).fill(null).map(() =>
      Array(this.width).fill(' ')
    );
  }

  /**
   * Write text at position
   */
  writeAt(x, y, text, fg = null, bg = null) {
    if (y < 0 || y >= this.height) return;

    for (let i = 0; i < text.length && x + i < this.width; i++) {
      if (x + i >= 0) {
        this.buffer[y][x + i] = text[i];
      }
    }
  }

  /**
   * Render the buffer to ANSI output
   */
  render() {
    let output = ANSI.CLEAR_SCREEN;

    for (let y = 0; y < this.height; y++) {
      output += cursorTo(y + 1, 1);
      output += this.buffer[y].join('');
    }

    return output;
  }

  /**
   * Get current buffer as string
   */
  toString() {
    return this.buffer.map(row => row.join('')).join('\n');
  }
}

/**
 * Terminal UI Helper for BBS screens
 */
export class BBSScreen {
  constructor(socket, writeFn) {
    this.socket = socket;
    this._writeFn = writeFn || null;
    this.width = 80;
    this.height = 24;

    // Status bar context (set after login via setContext)
    this._context = null;
  }

  /**
   * Send raw output
   */
  write(text) {
    if (this._writeFn) {
      this._writeFn(text);
    } else {
      this.socket.write(text);
    }
  }

  // ---------------------------------------------------------------------------
  // Part 1: Status Bar System
  // ---------------------------------------------------------------------------

  /**
   * Set the context used by status bars.
   * Call after login when connection properties are known.
   * @param {{ bbsName: string, nodeNumber: number, username: string, activity: string }} ctx
   */
  setContext(ctx) {
    this._context = ctx;
  }

  /**
   * Draw the top status bar (row 1).
   * Format: " BBS Name          Node: N  User: username "
   * Blue background with bright white/yellow text.
   */
  statusBarTop(bbsName, nodeNumber, username) {
    const save = '\x1b[s';
    const restore = '\x1b[u';

    const left = ' ' + bbsName;
    const right = 'Node: ' + nodeNumber + '  User: ' + username + ' ';
    const gap = this.width - left.length - right.length;
    const bar = left + (gap > 0 ? ' '.repeat(gap) : '  ') + right;

    this.write(save);
    this.write(cursorTo(1, 1));
    this.write(ANSI.BG_BLUE + ANSI.FG_WHITE + ANSI.BRIGHT);
    this.write(padText(bar, this.width));
    this.write(ANSI.RESET);
    this.write(restore);
  }

  /**
   * Draw the bottom status bar (row 24).
   * Format: " [Activity]          HH:MM PM  [?]=Help "
   * Blue background with bright white/yellow text.
   */
  statusBarBottom(area, extraInfo) {
    const save = '\x1b[s';
    const restore = '\x1b[u';

    const now = new Date();
    let hours = now.getHours();
    const ampm = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const timeStr = hours + ':' + minutes + ' ' + ampm;

    const left = ' [' + (area || 'Main Menu') + ']';
    const right = (extraInfo ? extraInfo + '  ' : '') + timeStr + '  [?]=Help ';
    const gap = this.width - left.length - right.length;
    const bar = left + (gap > 0 ? ' '.repeat(gap) : '  ') + right;

    this.write(save);
    this.write(cursorTo(this.height, 1));
    this.write(ANSI.BG_BLUE + ANSI.FG_YELLOW + ANSI.BRIGHT);
    this.write(padText(bar, this.width));
    this.write(ANSI.RESET);
    this.write(restore);
  }

  /**
   * Redraw both status bars using stored context.
   * Safe to call even if context is not yet set.
   */
  redrawStatusBars() {
    if (!this._context) return;
    const ctx = this._context;
    this.statusBarTop(ctx.bbsName, ctx.nodeNumber, ctx.username);
    this.statusBarBottom(ctx.activity);
  }

  /**
   * Update just the activity shown on the bottom status bar.
   * @param {string} activity
   */
  updateActivity(activity) {
    if (this._context) {
      this._context.activity = activity;
    }
    this.redrawStatusBars();
  }

  /**
   * Clear the entire screen and redraw status bars.
   */
  clear() {
    this.write(ANSI.CLEAR_SCREEN);
    this.redrawStatusBars();
  }

  /**
   * Clear only the content area (rows 2-23) between status bars.
   * Leaves row 1 (top bar) and row 24 (bottom bar) intact.
   */
  clearContent() {
    for (let row = 2; row <= this.height - 1; row++) {
      this.write(cursorTo(row, 1));
      this.write(ANSI.CLEAR_LINE);
    }
    // Position cursor at top of content area
    this.write(cursorTo(2, 1));
  }

  // ---------------------------------------------------------------------------
  // Part 2: Section Banners (code-generated)
  // ---------------------------------------------------------------------------

  /**
   * Generate a decorative section banner.
   *
   * @param {string} title - Section name (e.g. "MESSAGE FORUMS")
   * @param {'large'|'medium'|'small'} style - Visual weight
   */
  sectionBanner(title, style = 'medium') {
    const upper = title.toUpperCase();

    let tc;
    try { tc = getActiveTheme().colors; } catch (_) { tc = null; }
    const borderClr = tc ? color(tc.menuBorder.fg, null, tc.menuBorder.bright) : (ANSI.FG_CYAN + ANSI.BRIGHT);
    const titleClr  = tc ? color(tc.menuTitle.fg, null, tc.menuTitle.bright) : (ANSI.FG_YELLOW + ANSI.BRIGHT);
    const accentClr = ANSI.FG_WHITE + ANSI.BRIGHT;

    if (style === 'large') {
      // Style 1: double-line box with shade accents — for Main Menu
      const innerWidth = Math.max(upper.length + 10, 54);
      const titlePad = Math.floor((innerWidth - upper.length) / 2);
      const titleRight = innerWidth - upper.length - titlePad;
      const shadeBar = '\u2591\u2592\u2593\u2588';  // ░▒▓█
      const shadeBarR = '\u2588\u2593\u2592\u2591';  // █▓▒░
      const offset = Math.floor((this.width - innerWidth - 4) / 2);
      const pad = offset > 0 ? ' '.repeat(offset) : '';

      this.write('\r\n');
      this.write(pad + borderClr + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth + 2) + BOX.D_TOP_RIGHT + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_VERTICAL + ANSI.RESET);
      this.write(accentClr + ' ' + shadeBar + ANSI.RESET);
      this.write(titleClr + ' '.repeat(titlePad - 5) + upper + ' '.repeat(titleRight - 5) + ANSI.RESET);
      this.write(accentClr + shadeBarR + ' ' + ANSI.RESET);
      this.write(borderClr + BOX.D_VERTICAL + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth + 2) + BOX.D_BOTTOM_RIGHT + ANSI.RESET + '\r\n');
    } else if (style === 'medium') {
      // Style 2: bordered with corner accents — for Forums, Mail, Files
      const innerWidth = Math.max(upper.length + 8, 40);
      const titlePad = Math.floor((innerWidth - upper.length - 4) / 2);
      const titleRight = innerWidth - upper.length - 4 - titlePad;
      const offset = Math.floor((this.width - innerWidth - 2) / 2);
      const pad = offset > 0 ? ' '.repeat(offset) : '';

      this.write('\r\n');
      this.write(pad + borderClr + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth) + BOX.D_TOP_RIGHT + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_VERTICAL + ANSI.RESET);
      this.write(titleClr + ' '.repeat(titlePad) + '\u2261 ' + upper + ' \u2261' + ' '.repeat(titleRight) + ANSI.RESET);
      this.write(borderClr + BOX.D_VERTICAL + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth) + BOX.D_BOTTOM_RIGHT + ANSI.RESET + '\r\n');
    } else {
      // Style 3: minimal color bars — for Games, Chat, Polls, etc.
      const spaced = upper.split('').join(' ');
      const barWidth = Math.max(spaced.length + 4, 30);
      const titlePad = Math.floor((barWidth - spaced.length) / 2);
      const offset = Math.floor((this.width - barWidth) / 2);
      const pad = offset > 0 ? ' '.repeat(offset) : '';

      this.write('\r\n');
      this.write(pad + borderClr + '\u2580'.repeat(barWidth) + ANSI.RESET + '\r\n');
      this.write(pad + titleClr + ' '.repeat(titlePad) + spaced + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + '\u2584'.repeat(barWidth) + ANSI.RESET + '\r\n');
    }
  }

  // ---------------------------------------------------------------------------
  // Part 3: Improved Menu Rendering
  // ---------------------------------------------------------------------------

  /**
   * Display header with BBS name
   */
  header(bbsName, userName = 'Guest') {
    this.write(ANSI.CLEAR_SCREEN);
    this.write(ANSI.FG_CYAN + ANSI.BRIGHT + BOX.D_HORIZONTAL.repeat(this.width) + '\r\n' + ANSI.RESET);

    const namePad = Math.floor((this.width - bbsName.length) / 2);
    this.write(ANSI.FG_YELLOW + ANSI.BRIGHT);
    this.write(' '.repeat(namePad) + bbsName.toUpperCase() + '\r\n');
    this.write(ANSI.RESET);

    const userText = `User: ${userName}`;
    const userPad = Math.floor((this.width - userText.length) / 2);
    this.write(ANSI.FG_WHITE);
    this.write(' '.repeat(userPad) + userText + '\r\n');
    this.write(ANSI.RESET);

    this.write(ANSI.FG_CYAN + ANSI.BRIGHT + BOX.D_HORIZONTAL.repeat(this.width) + '\r\n' + ANSI.RESET);
  }

  /**
   * Display footer
   */
  footer(text = '') {
    this.write(cursorTo(this.height - 1, 1));
    this.write(colorText(BOX.HORIZONTAL.repeat(this.width), 'cyan'));
    this.write(cursorTo(this.height, 1));
    this.write(colorText(padText(text, this.width), 'white', 'blue'));
  }

  /**
   * Display menu with section banner, improved item formatting, and theme colors.
   */
  menu(title, items, prompt = 'Selection') {
    if (this._context) {
      this.clearContent();
    } else {
      this.clear();
    }

    // Load theme colours (safe fallback if theme service not ready)
    let tc;
    try { tc = getActiveTheme().colors; } catch (_) { tc = null; }

    const borderColor = tc ? color(tc.menuBorder.fg, null, tc.menuBorder.bright) : (ANSI.FG_CYAN + ANSI.BRIGHT);
    const titleColor  = tc ? color(tc.menuTitle.fg, null, tc.menuTitle.bright) : (ANSI.FG_YELLOW + ANSI.BRIGHT);
    const keyColor    = tc ? color(tc.menuKey.fg, null, tc.menuKey.bright) : (ANSI.FG_GREEN + ANSI.BRIGHT);
    const itemColor   = tc ? color(tc.menuItem.fg, null, tc.menuItem.bright) : ANSI.FG_WHITE;
    const promptColor = tc ? color(tc.prompt.fg, null, tc.prompt.bright) : (ANSI.FG_YELLOW + ANSI.BRIGHT);

    // Determine banner style based on title
    const bannerStyle = title.toUpperCase() === 'MAIN MENU' ? 'large' : 'medium';
    this.sectionBanner(title, bannerStyle);

    // Menu items — improved format: "  [K]  Item Text"
    const menuWidth = 54;
    const menuOffset = Math.floor((this.width - menuWidth) / 2);
    const menuPad = menuOffset > 0 ? ' '.repeat(menuOffset) : '';

    this.write('\r\n');
    items.forEach(item => {
      this.write(menuPad);
      this.write(borderColor + BOX.VERTICAL + ANSI.RESET + '  ');
      this.write(keyColor + '[' + item.key + ']' + ANSI.RESET + '  ');
      this.write(itemColor + padText(item.text, menuWidth - 10) + ANSI.RESET);
      this.write(borderColor + BOX.VERTICAL + ANSI.RESET + '\r\n');
    });

    // Separator
    this.write(menuPad + borderColor + BOX.BOTTOM_LEFT + BOX.HORIZONTAL.repeat(menuWidth - 2) + BOX.BOTTOM_RIGHT + ANSI.RESET + '\r\n');

    this.write('\r\n');
    this.write(menuPad + promptColor + prompt + ': ' + ANSI.RESET);
  }

  /**
   * Display a list of items
   */
  list(title, items, startIndex = 0) {
    let output = '\r\n';
    output += colorText(` ${title}`, 'yellow', null, true) + '\r\n';
    output += colorText(BOX.HORIZONTAL.repeat(this.width), 'cyan') + '\r\n';

    items.slice(startIndex, startIndex + 15).forEach((item, idx) => {
      output += colorText(padText(`[${startIndex + idx + 1}]`, 6), 'green', null, true);
      output += colorText(item, 'white') + '\r\n';
    });

    output += colorText(BOX.HORIZONTAL.repeat(this.width), 'cyan') + '\r\n';
    this.write(output);
  }

  /**
   * Display ASCII art or ANSI file
   */
  displayArt(artContent) {
    this.clear();
    this.write(artContent);
  }

  /**
   * Prompt for input
   */
  prompt(text, fg = 'yellow') {
    this.write(colorText(text, fg, null, true));
  }

  /**
   * Display message box with improved box-drawing.
   */
  messageBox(title, message, boxType = 'info') {
    const colorMap = {
      info:    { border: ANSI.FG_CYAN,   title: ANSI.FG_WHITE,  text: ANSI.FG_WHITE },
      success: { border: ANSI.FG_GREEN,  title: ANSI.FG_GREEN,  text: ANSI.FG_WHITE },
      warning: { border: ANSI.FG_YELLOW, title: ANSI.FG_YELLOW, text: ANSI.FG_WHITE },
      error:   { border: ANSI.FG_RED,    title: ANSI.FG_RED,    text: ANSI.FG_WHITE }
    };

    const c = colorMap[boxType] || colorMap.info;
    const width = 60;
    const offset = Math.floor((this.width - width) / 2);
    const pad = offset > 0 ? ' '.repeat(offset) : '';

    this.write('\r\n');

    // Top border
    this.write(pad + c.border + ANSI.BRIGHT + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(width - 2) + BOX.D_TOP_RIGHT + ANSI.RESET + '\r\n');

    // Title line
    const titlePad = Math.floor((width - 2 - title.length) / 2);
    this.write(pad + c.border + ANSI.BRIGHT + BOX.D_VERTICAL + ANSI.RESET);
    this.write(c.title + ANSI.BRIGHT);
    this.write(' '.repeat(titlePad) + title + ' '.repeat(width - 2 - title.length - titlePad));
    this.write(ANSI.RESET + c.border + ANSI.BRIGHT + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);

    // Separator
    this.write(pad + c.border + ANSI.BRIGHT + BOX.D_T_RIGHT + BOX.D_HORIZONTAL.repeat(width - 2) + BOX.D_LEFT + '\r\n' + ANSI.RESET);

    // Word wrap message
    const words = message.split(' ');
    let line = '';

    words.forEach(word => {
      if ((line + word).length > width - 6) {
        this.write(pad + c.border + ANSI.BRIGHT + BOX.D_VERTICAL + ' ' + ANSI.RESET);
        this.write(c.text + padText(line.trim(), width - 4) + ANSI.RESET);
        this.write(c.border + ANSI.BRIGHT + ' ' + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    });

    if (line.trim()) {
      this.write(pad + c.border + ANSI.BRIGHT + BOX.D_VERTICAL + ' ' + ANSI.RESET);
      this.write(c.text + padText(line.trim(), width - 4) + ANSI.RESET);
      this.write(c.border + ANSI.BRIGHT + ' ' + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);
    }

    // Bottom border
    this.write(pad + c.border + ANSI.BRIGHT + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(width - 2) + BOX.D_BOTTOM_RIGHT + '\r\n' + ANSI.RESET);
    this.write('\r\n');
    this.write(pad + ANSI.FG_WHITE + 'Press any key to continue...\r\n' + ANSI.RESET);
  }

  // ---------------------------------------------------------------------------
  // Part 5: Improved Welcome Screen
  // ---------------------------------------------------------------------------

  /**
   * Display welcome/login screen.
   * Attempts to load art/welcome.ans first; falls back to a code-generated screen.
   */
  async welcomeScreen(bbsName, version = '1.1') {
    this.write(ANSI.CLEAR_SCREEN);

    // Try to load ANSI art welcome screen
    try {
      const { content } = await loadArt('welcome.ans');
      if (content) {
        this.write(content);
        return;
      }
    } catch (_) {
      // No art file — render code-based welcome
    }

    this._renderCodeWelcome(bbsName, version);
  }

  /**
   * Code-based welcome screen with block-letter BBS name,
   * version info, and decorative elements.
   * @private
   */
  _renderCodeWelcome(bbsName, version) {
    const upper = bbsName.toUpperCase();
    const boxInner = 66;
    const offset = Math.floor((this.width - boxInner - 4) / 2);
    const pad = offset > 0 ? ' '.repeat(offset) : '';

    // Helper to write a centered line inside the box
    const writeLine = (text, clr = ANSI.FG_WHITE) => {
      const leftP = Math.floor((boxInner - text.length) / 2);
      const rightP = boxInner - text.length - leftP;
      this.write(pad + ANSI.FG_CYAN + ANSI.BRIGHT + BOX.D_VERTICAL + ANSI.RESET);
      this.write(clr + ANSI.BRIGHT + ' '.repeat(leftP) + text + ' '.repeat(rightP) + ANSI.RESET);
      this.write(ANSI.FG_CYAN + ANSI.BRIGHT + BOX.D_VERTICAL + ANSI.RESET + '\r\n');
    };

    // Block-letter style: 3-line height using block chars (simple)
    // Spaced-out title with block accents
    const spaced = upper.split('').join(' ');
    const blockBar = '\u2588'.repeat(Math.min(spaced.length + 4, boxInner - 4));
    const shadeBar = '\u2591\u2592\u2593' + '\u2588'.repeat(Math.max(blockBar.length - 6, 2)) + '\u2593\u2592\u2591';

    this.write('\r\n');
    // Top border
    this.write(pad + ANSI.FG_CYAN + ANSI.BRIGHT + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(boxInner) + BOX.D_TOP_RIGHT + ANSI.RESET + '\r\n');

    writeLine('', ANSI.FG_WHITE);

    // Block-letter banner
    writeLine(shadeBar, ANSI.FG_BLUE);
    writeLine(spaced, ANSI.FG_YELLOW);
    writeLine(shadeBar, ANSI.FG_BLUE);

    writeLine('', ANSI.FG_WHITE);
    writeLine('W E L C O M E', ANSI.FG_WHITE);
    writeLine('', ANSI.FG_WHITE);

    // Decorative diamond pattern
    writeLine('.:^^~!7777777777!~^^:.', ANSI.FG_RED);
    writeLine('.~7JY5PPPPPPPPPPPPPPPP5YJ7~.', ANSI.FG_RED);
    writeLine(':!JPGBBBBBBBBBBBBBBBBBBBBBBGPJ!:', ANSI.FG_RED);
    writeLine('.~7JY5PPPPPPPPPPPPPPPP5YJ7~.', ANSI.FG_RED);
    writeLine('.:^^~!7777777777!~^^:.', ANSI.FG_RED);

    writeLine('', ANSI.FG_WHITE);
    writeLine('Version ' + version, ANSI.FG_GREEN);
    writeLine('', ANSI.FG_WHITE);

    // Bottom border
    this.write(pad + ANSI.FG_CYAN + ANSI.BRIGHT + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(boxInner) + BOX.D_BOTTOM_RIGHT + ANSI.RESET + '\r\n');
    this.write('\r\n');
  }
}

export default BBSScreen;
