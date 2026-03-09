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

  /**
   * Set the context (kept for API compatibility, no-op now).
   */
  setContext(ctx) {
    this._context = ctx;
  }

  /**
   * Update activity (kept for API compatibility, no-op now).
   */
  updateActivity(activity) {
    if (this._context) {
      this._context.activity = activity;
    }
  }

  /**
   * Clear screen.
   */
  clear() {
    this.write(ANSI.CLEAR_SCREEN);
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

    // All banners use the same total width (54) to match menu box
    const totalWidth = 54;
    const innerWidth = totalWidth - 2; // inside the border chars
    const menuOffset = Math.floor((this.width - totalWidth) / 2);
    const pad = menuOffset > 0 ? ' '.repeat(menuOffset) : '';

    if (style === 'large') {
      // Double-line box with shade accents — for Main Menu
      const shadeBar = '\u2591\u2592\u2593\u2588';  // ░▒▓█  (4 chars)
      const shadeBarR = '\u2588\u2593\u2592\u2591';  // █▓▒░  (4 chars)
      // Inside: space + shade(4) + space + title + space + shade(4) + space = title + 12
      const titleSpace = innerWidth - 12;
      const titleLeft = Math.floor((titleSpace - upper.length) / 2);
      const titleRight = titleSpace - upper.length - titleLeft;

      this.write('\r\n');
      this.write(pad + borderClr + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth) + BOX.D_TOP_RIGHT + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_VERTICAL + ANSI.RESET);
      this.write(accentClr + ' ' + shadeBar + ' ' + ANSI.RESET);
      this.write(titleClr + ' '.repeat(titleLeft) + upper + ' '.repeat(titleRight) + ANSI.RESET);
      this.write(accentClr + ' ' + shadeBarR + ' ' + ANSI.RESET);
      this.write(borderClr + BOX.D_VERTICAL + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth) + BOX.D_BOTTOM_RIGHT + ANSI.RESET + '\r\n');
    } else if (style === 'medium') {
      // Bordered with corner accents — for Forums, Mail, Files
      // Inside: spaces + "= " + title + " =" + spaces = title + 4 + padding
      const contentWidth = upper.length + 4; // "= TITLE ="
      const leftPad = Math.floor((innerWidth - contentWidth) / 2);
      const rightPad = innerWidth - contentWidth - leftPad;

      this.write('\r\n');
      this.write(pad + borderClr + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth) + BOX.D_TOP_RIGHT + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_VERTICAL + ANSI.RESET);
      this.write(' '.repeat(leftPad) + titleClr + '\u2261 ' + upper + ' \u2261' + ANSI.RESET + ' '.repeat(rightPad));
      this.write(borderClr + BOX.D_VERTICAL + ANSI.RESET + '\r\n');
      this.write(pad + borderClr + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(innerWidth) + BOX.D_BOTTOM_RIGHT + ANSI.RESET + '\r\n');
    } else {
      // Minimal color bars — for Games, Chat, Polls, etc.
      const spaced = upper.split('').join(' ');
      const barWidth = totalWidth;
      const titlePad = Math.floor((barWidth - spaced.length) / 2);
      const titleRight = barWidth - spaced.length - titlePad;

      this.write('\r\n');
      this.write(pad + borderClr + '\u2580'.repeat(barWidth) + ANSI.RESET + '\r\n');
      this.write(pad + ' '.repeat(titlePad) + titleClr + spaced + ANSI.RESET + ' '.repeat(titleRight) + '\r\n');
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
    this.clear();

    // Load theme colours (safe fallback if theme service not ready)
    let tc;
    try { tc = getActiveTheme().colors; } catch (_) { tc = null; }

    const borderColor = tc ? color(tc.menuBorder.fg, null, tc.menuBorder.bright) : (ANSI.FG_CYAN + ANSI.BRIGHT);
    const keyColor    = tc ? color(tc.menuKey.fg, null, tc.menuKey.bright) : (ANSI.FG_GREEN + ANSI.BRIGHT);
    const itemColor   = tc ? color(tc.menuItem.fg, null, tc.menuItem.bright) : ANSI.FG_WHITE;
    const promptColor = tc ? color(tc.prompt.fg, null, tc.prompt.bright) : (ANSI.FG_YELLOW + ANSI.BRIGHT);

    // Determine banner style based on title
    const bannerStyle = title.toUpperCase() === 'MAIN MENU' ? 'large' : 'medium';
    this.sectionBanner(title, bannerStyle);

    // Menu layout: fixed 52 visible characters inside the box
    // Border chars: left + right = 2, so total line = 54 visible chars
    const innerWidth = 52;
    const totalWidth = innerWidth + 2;
    const menuOffset = Math.floor((this.width - totalWidth) / 2);
    const menuPad = menuOffset > 0 ? ' '.repeat(menuOffset) : '';

    // Top border
    this.write(menuPad + borderColor + BOX.TOP_LEFT + BOX.HORIZONTAL.repeat(innerWidth) + BOX.TOP_RIGHT + ANSI.RESET + '\r\n');

    // Menu items: "│  [K]  Item Text                              │"
    // Inside: 2 spaces + [K] (3) + 2 spaces + text padded to (innerWidth - 7) = 45
    const textWidth = innerWidth - 7;
    items.forEach(item => {
      this.write(menuPad);
      this.write(borderColor + BOX.VERTICAL + ANSI.RESET);
      this.write('  ' + keyColor + '[' + item.key + ']' + ANSI.RESET);
      this.write('  ' + itemColor + padText(item.text, textWidth) + ANSI.RESET);
      this.write(borderColor + BOX.VERTICAL + ANSI.RESET + '\r\n');
    });

    // Bottom border
    this.write(menuPad + borderColor + BOX.BOTTOM_LEFT + BOX.HORIZONTAL.repeat(innerWidth) + BOX.BOTTOM_RIGHT + ANSI.RESET + '\r\n');

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
