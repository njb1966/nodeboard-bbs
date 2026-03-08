/**
 * ANSI/VT100 Codes and Utilities for BBS Terminal Rendering
 */

export const ANSI = {
  // Control codes
  ESC: '\x1b',
  CSI: '\x1b[',
  BELL: '\x07',

  // Cursor control
  CURSOR_HOME: '\x1b[H',
  CURSOR_HIDE: '\x1b[?25l',
  CURSOR_SHOW: '\x1b[?25h',
  CLEAR_SCREEN: '\x1b[2J\x1b[H',
  CLEAR_LINE: '\x1b[2K',
  CLEAR_TO_EOL: '\x1b[K',

  // Text attributes
  RESET: '\x1b[0m',
  BRIGHT: '\x1b[1m',
  DIM: '\x1b[2m',
  UNDERSCORE: '\x1b[4m',
  BLINK: '\x1b[5m',
  REVERSE: '\x1b[7m',
  HIDDEN: '\x1b[8m',

  // Foreground colors
  FG_BLACK: '\x1b[30m',
  FG_RED: '\x1b[31m',
  FG_GREEN: '\x1b[32m',
  FG_YELLOW: '\x1b[33m',
  FG_BLUE: '\x1b[34m',
  FG_MAGENTA: '\x1b[35m',
  FG_CYAN: '\x1b[36m',
  FG_WHITE: '\x1b[37m',

  // Background colors
  BG_BLACK: '\x1b[40m',
  BG_RED: '\x1b[41m',
  BG_GREEN: '\x1b[42m',
  BG_YELLOW: '\x1b[43m',
  BG_BLUE: '\x1b[44m',
  BG_MAGENTA: '\x1b[45m',
  BG_CYAN: '\x1b[46m',
  BG_WHITE: '\x1b[47m',

  // Extended colors (bright versions)
  FG_BRIGHT_BLACK: '\x1b[90m',
  FG_BRIGHT_RED: '\x1b[91m',
  FG_BRIGHT_GREEN: '\x1b[92m',
  FG_BRIGHT_YELLOW: '\x1b[93m',
  FG_BRIGHT_BLUE: '\x1b[94m',
  FG_BRIGHT_MAGENTA: '\x1b[95m',
  FG_BRIGHT_CYAN: '\x1b[96m',
  FG_BRIGHT_WHITE: '\x1b[97m',
};

/**
 * Move cursor to position
 */
export function cursorTo(row, col) {
  return `\x1b[${row};${col}H`;
}

/**
 * Move cursor up/down/left/right
 */
export function cursorUp(n = 1) { return `\x1b[${n}A`; }
export function cursorDown(n = 1) { return `\x1b[${n}B`; }
export function cursorForward(n = 1) { return `\x1b[${n}C`; }
export function cursorBack(n = 1) { return `\x1b[${n}D`; }

/**
 * Color helper functions
 */
export function color(fg, bg = null, bright = false) {
  const fgColors = {
    black: 30, red: 31, green: 32, yellow: 33,
    blue: 34, magenta: 35, cyan: 36, white: 37
  };

  const bgColors = {
    black: 40, red: 41, green: 42, yellow: 43,
    blue: 44, magenta: 45, cyan: 46, white: 47
  };

  let code = '';
  if (bright) code += '\x1b[1m';
  if (fg && fgColors[fg]) code += `\x1b[${fgColors[fg]}m`;
  if (bg && bgColors[bg]) code += `\x1b[${bgColors[bg]}m`;

  return code;
}

/**
 * Create colored text
 */
export function colorText(text, fg, bg = null, bright = false) {
  return color(fg, bg, bright) + text + ANSI.RESET;
}

/**
 * Box drawing characters (CP437/ASCII compatible)
 * Using ASCII characters that work in all terminals
 */
export const BOX = {
  // Single line (ASCII-safe)
  TOP_LEFT: '+',
  TOP_RIGHT: '+',
  BOTTOM_LEFT: '+',
  BOTTOM_RIGHT: '+',
  HORIZONTAL: '-',
  VERTICAL: '|',
  T_DOWN: '+',
  T_UP: '+',
  T_RIGHT: '+',
  T_LEFT: '+',
  CROSS: '+',

  // Double line (ASCII-safe)
  D_TOP_LEFT: '+',
  D_TOP_RIGHT: '+',
  D_BOTTOM_LEFT: '+',
  D_BOTTOM_RIGHT: '+',
  D_HORIZONTAL: '=',
  D_VERTICAL: '|',
  D_T_DOWN: '+',
  D_T_UP: '+',
  D_T_RIGHT: '+',
  D_LEFT: '+',
  D_CROSS: '+',
};

/**
 * Draw a box on screen
 */
export function drawBox(x, y, width, height, title = '', doubleLines = false) {
  const box = doubleLines ? {
    tl: BOX.D_TOP_LEFT, tr: BOX.D_TOP_RIGHT,
    bl: BOX.D_BOTTOM_LEFT, br: BOX.D_BOTTOM_RIGHT,
    h: BOX.D_HORIZONTAL, v: BOX.D_VERTICAL
  } : {
    tl: BOX.TOP_LEFT, tr: BOX.TOP_RIGHT,
    bl: BOX.BOTTOM_LEFT, br: BOX.BOTTOM_RIGHT,
    h: BOX.HORIZONTAL, v: BOX.VERTICAL
  };

  let output = '';

  // Top border
  output += cursorTo(y, x);
  output += box.tl;
  if (title) {
    const titlePadding = Math.floor((width - title.length - 4) / 2);
    output += box.h.repeat(titlePadding);
    output += ` ${title} `;
    output += box.h.repeat(width - titlePadding - title.length - 4);
  } else {
    output += box.h.repeat(width - 2);
  }
  output += box.tr;

  // Sides
  for (let i = 1; i < height - 1; i++) {
    output += cursorTo(y + i, x);
    output += box.v;
    output += cursorTo(y + i, x + width - 1);
    output += box.v;
  }

  // Bottom border
  output += cursorTo(y + height - 1, x);
  output += box.bl;
  output += box.h.repeat(width - 2);
  output += box.br;

  return output;
}

/**
 * Center text on a line
 */
export function centerText(text, width) {
  const padding = Math.floor((width - text.length) / 2);
  return ' '.repeat(padding) + text;
}

/**
 * Pad text to width
 */
export function padText(text, width, char = ' ') {
  if (text.length >= width) return text.substring(0, width);
  return text + char.repeat(width - text.length);
}

/**
 * Strip ANSI codes from text (for length calculation)
 */
export function stripAnsi(text) {
  return text.replace(/\x1b\[[0-9;]*m/g, '');
}

/**
 * Get visible length of text (excluding ANSI codes)
 */
export function visibleLength(text) {
  return stripAnsi(text).length;
}

/**
 * Create a horizontal line
 */
export function horizontalLine(width, char = BOX.HORIZONTAL) {
  return char.repeat(width);
}

/**
 * Parse CP437 to Unicode for proper display
 */
export function cp437ToUnicode(text) {
  // Basic CP437 character mapping (can be expanded)
  const map = {
    '\xB0': '░', '\xB1': '▒', '\xB2': '▓', '\xDB': '█',
    '\xC4': '─', '\xB3': '│', '\xDA': '┌', '\xBF': '┐',
    '\xC0': '└', '\xD9': '┘', '\xC3': '├', '\xB4': '┤',
    '\xC1': '┴', '\xC2': '┬', '\xC5': '┼'
  };

  return text.split('').map(c => map[c] || c).join('');
}

export default ANSI;
