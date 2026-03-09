/**
 * Screen buffer and rendering utilities
 */
import { ANSI, BOX, cursorTo, drawBox, centerText, padText, colorText, color } from './ansi.js';
import { getActiveTheme } from '../services/ThemeService.js';

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
  constructor(socket) {
    this.socket = socket;
    this.width = 80;
    this.height = 24;
  }

  /**
   * Send raw output
   */
  write(text) {
    this.socket.write(text);
  }

  /**
   * Clear screen
   */
  clear() {
    this.write(ANSI.CLEAR_SCREEN);
  }

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
   * Display menu — uses active theme colors when available.
   */
  menu(title, items, prompt = 'Selection') {
    this.clear();

    // Load theme colours (safe fallback if theme service not ready)
    let tc;
    try { tc = getActiveTheme().colors; } catch (_) { tc = null; }

    const borderColor = tc ? color(tc.menuBorder.fg, null, tc.menuBorder.bright) : (ANSI.FG_CYAN + ANSI.BRIGHT);
    const titleColor  = tc ? color(tc.menuTitle.fg, null, tc.menuTitle.bright) : (ANSI.FG_YELLOW + ANSI.BRIGHT);
    const keyColor    = tc ? color(tc.menuKey.fg, null, tc.menuKey.bright) : (ANSI.FG_GREEN + ANSI.BRIGHT);
    const itemColor   = tc ? color(tc.menuItem.fg, null, tc.menuItem.bright) : ANSI.FG_WHITE;
    const promptColor = tc ? color(tc.prompt.fg, null, tc.prompt.bright) : (ANSI.FG_YELLOW + ANSI.BRIGHT);

    this.write('\r\n');
    this.write(borderColor + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(51) + BOX.D_TOP_RIGHT + '\r\n' + ANSI.RESET);

    // Title line
    const titlePad = Math.floor((51 - title.length) / 2);
    this.write(borderColor + BOX.D_VERTICAL + ANSI.RESET);
    this.write(titleColor);
    this.write(' '.repeat(titlePad) + title.toUpperCase() + ' '.repeat(51 - title.length - titlePad));
    this.write(ANSI.RESET + borderColor + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);

    this.write(borderColor + BOX.D_T_RIGHT + BOX.D_HORIZONTAL.repeat(51) + BOX.D_LEFT + '\r\n' + ANSI.RESET);

    // Menu items
    items.forEach(item => {
      this.write(borderColor + BOX.D_VERTICAL + ' ' + ANSI.RESET);
      this.write(keyColor + padText(item.key, 3) + ANSI.RESET);
      this.write(itemColor + padText(item.text, 46) + ANSI.RESET);
      this.write(borderColor + ' ' + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);
    });

    this.write(borderColor + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(51) + BOX.D_BOTTOM_RIGHT + '\r\n' + ANSI.RESET);
    this.write('\r\n');
    this.write(promptColor + prompt + ': ' + ANSI.RESET);
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
   * Display message box
   */
  messageBox(title, message, boxType = 'info') {
    const colorMap = {
      info: { border: ANSI.FG_CYAN, title: ANSI.FG_WHITE, text: ANSI.FG_WHITE },
      success: { border: ANSI.FG_GREEN, title: ANSI.FG_GREEN, text: ANSI.FG_WHITE },
      warning: { border: ANSI.FG_YELLOW, title: ANSI.FG_YELLOW, text: ANSI.FG_WHITE },
      error: { border: ANSI.FG_RED, title: ANSI.FG_RED, text: ANSI.FG_WHITE }
    };

    const c = colorMap[boxType] || colorMap.info;
    const width = 60;

    this.write('\r\n');
    this.write(c.border + ANSI.BRIGHT + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(width - 2) + BOX.D_TOP_RIGHT + '\r\n' + ANSI.RESET);

    // Title line
    const titlePad = Math.floor((width - 2 - title.length) / 2);
    this.write(c.border + ANSI.BRIGHT + BOX.D_VERTICAL + ANSI.RESET);
    this.write(c.title + ANSI.BRIGHT);
    this.write(' '.repeat(titlePad) + title + ' '.repeat(width - 2 - title.length - titlePad));
    this.write(ANSI.RESET + c.border + ANSI.BRIGHT + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);

    this.write(c.border + ANSI.BRIGHT + BOX.D_T_RIGHT + BOX.D_HORIZONTAL.repeat(width - 2) + BOX.D_LEFT + '\r\n' + ANSI.RESET);

    // Word wrap message
    const words = message.split(' ');
    let line = '';

    words.forEach(word => {
      if ((line + word).length > width - 6) {
        this.write(c.border + ANSI.BRIGHT + BOX.D_VERTICAL + ' ' + ANSI.RESET);
        this.write(c.text + padText(line.trim(), width - 4) + ANSI.RESET);
        this.write(c.border + ANSI.BRIGHT + ' ' + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);
        line = word + ' ';
      } else {
        line += word + ' ';
      }
    });

    if (line.trim()) {
      this.write(c.border + ANSI.BRIGHT + BOX.D_VERTICAL + ' ' + ANSI.RESET);
      this.write(c.text + padText(line.trim(), width - 4) + ANSI.RESET);
      this.write(c.border + ANSI.BRIGHT + ' ' + BOX.D_VERTICAL + '\r\n' + ANSI.RESET);
    }

    this.write(c.border + ANSI.BRIGHT + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(width - 2) + BOX.D_BOTTOM_RIGHT + '\r\n' + ANSI.RESET);
    this.write('\r\n');
    this.write(ANSI.FG_WHITE + 'Press any key to continue...\r\n' + ANSI.RESET);
  }

  /**
   * Display welcome/login screen
   */
  welcomeScreen(bbsName, version = '1.1') {
    this.clear();

    // Helper to write a colored line with exact padding (66 visible chars)
    const writeLine = (text, color = ANSI.FG_WHITE) => {
      const padding = Math.floor((66 - text.length) / 2);
      const rightPad = 66 - text.length - padding;
      this.write(ANSI.FG_CYAN + ANSI.BRIGHT);
      this.write('  ' + BOX.D_VERTICAL);
      this.write(ANSI.RESET);
      this.write(color + ANSI.BRIGHT);
      this.write(' '.repeat(padding) + text + ' '.repeat(rightPad));
      this.write(ANSI.RESET);
      this.write(ANSI.FG_CYAN + ANSI.BRIGHT);
      this.write(BOX.D_VERTICAL);
      this.write(ANSI.RESET);
      this.write('\r\n');
    };

    this.write('\r\n\r\n');
    this.write(ANSI.FG_CYAN + ANSI.BRIGHT);
    this.write('  ' + BOX.D_TOP_LEFT + BOX.D_HORIZONTAL.repeat(66) + BOX.D_TOP_RIGHT + '\r\n');
    this.write(ANSI.RESET);

    writeLine('', ANSI.FG_WHITE);
    writeLine('Welcome to the BBS', ANSI.FG_YELLOW);
    writeLine('', ANSI.FG_WHITE);
    writeLine('.:^^~!7777777777!~^^:.', ANSI.FG_RED);
    writeLine('.~7JY5PPPPPPPPPPPPPPPP5YJ7~.', ANSI.FG_RED);
    writeLine(':!JPGBBBBBBBBBBBBBBBBBBBBBBGPJ!:', ANSI.FG_RED);
    writeLine('.~YGBBBBBBBBBBBBBBBBBBBBBBBBBBBBGY~.', ANSI.FG_RED);
    writeLine('^YGBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBGY^', ANSI.FG_RED);
    writeLine('.~YGBBBBBBBBBBBBBBBBBBBBBBBBBBBBGY~.', ANSI.FG_RED);
    writeLine(':!JPGBBBBBBBBBBBBBBBBBBBBBBGPJ!:', ANSI.FG_RED);
    writeLine('.~7JY5PPPPPPPPPPPPPPPP5YJ7~.', ANSI.FG_RED);
    writeLine('.:^^~!7777777777!~^^:.', ANSI.FG_RED);
    writeLine('', ANSI.FG_WHITE);
    writeLine('SOULTHREAD BBS', ANSI.FG_GREEN);
    writeLine('Sysop: Soulthreader', ANSI.FG_WHITE);
    writeLine('', ANSI.FG_WHITE);

    this.write(ANSI.FG_CYAN + ANSI.BRIGHT);
    this.write('  ' + BOX.D_BOTTOM_LEFT + BOX.D_HORIZONTAL.repeat(66) + BOX.D_BOTTOM_RIGHT + '\r\n');
    this.write(ANSI.RESET);
    this.write('\r\n');
  }
}

export default BBSScreen;
