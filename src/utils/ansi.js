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
 * Box drawing characters (Unicode)
 * Using proper Unicode box-drawing characters for clean terminal rendering
 */
export const BOX = {
  // Single line
  TOP_LEFT: '┌',
  TOP_RIGHT: '┐',
  BOTTOM_LEFT: '└',
  BOTTOM_RIGHT: '┘',
  HORIZONTAL: '─',
  VERTICAL: '│',
  T_DOWN: '┬',
  T_UP: '┴',
  T_RIGHT: '├',
  T_LEFT: '┤',
  CROSS: '┼',

  // Double line
  D_TOP_LEFT: '╔',
  D_TOP_RIGHT: '╗',
  D_BOTTOM_LEFT: '╚',
  D_BOTTOM_RIGHT: '╝',
  D_HORIZONTAL: '═',
  D_VERTICAL: '║',
  D_T_DOWN: '╦',
  D_T_UP: '╩',
  D_T_RIGHT: '╠',
  D_LEFT: '╣',
  D_CROSS: '╬',
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

/**
 * Full CP437 table (indices 0x00-0xFF) mapping byte values to Unicode codepoints.
 * Built from the authoritative table in artloader.js.
 */
const CP437_TO_UNICODE = [
  '\u0000', '\u263A', '\u263B', '\u2665', '\u2666', '\u2663', '\u2660', '\u2022',
  '\u25D8', '\u25CB', '\u25D9', '\u2642', '\u2640', '\u266A', '\u266B', '\u263C',
  '\u25BA', '\u25C4', '\u2195', '\u203C', '\u00B6', '\u00A7', '\u25AC', '\u21A8',
  '\u2191', '\u2193', '\u2192', '\u001B', '\u221F', '\u2194', '\u25B2', '\u25BC',
  // 0x20-0x7E: standard ASCII
  ' ', '!', '"', '#', '$', '%', '&', "'", '(', ')', '*', '+', ',', '-', '.', '/',
  '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', ':', ';', '<', '=', '>', '?',
  '@', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O',
  'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z', '[', '\\', ']', '^', '_',
  '`', 'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o',
  'p', 'q', 'r', 's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '{', '|', '}', '~', '\u2302',
  // 0x80-0xFF: extended CP437
  '\u00C7', '\u00FC', '\u00E9', '\u00E2', '\u00E4', '\u00E0', '\u00E5', '\u00E7',
  '\u00EA', '\u00EB', '\u00E8', '\u00EF', '\u00EE', '\u00EC', '\u00C4', '\u00C5',
  '\u00C9', '\u00E6', '\u00C6', '\u00F4', '\u00F6', '\u00F2', '\u00FB', '\u00F9',
  '\u00FF', '\u00D6', '\u00DC', '\u00A2', '\u00A3', '\u00A5', '\u20A7', '\u0192',
  '\u00E1', '\u00ED', '\u00F3', '\u00FA', '\u00F1', '\u00D1', '\u00AA', '\u00BA',
  '\u00BF', '\u2310', '\u00AC', '\u00BD', '\u00BC', '\u00A1', '\u00AB', '\u00BB',
  '\u2591', '\u2592', '\u2593', '\u2502', '\u2524', '\u2561', '\u2562', '\u2556',
  '\u2555', '\u2563', '\u2551', '\u2557', '\u255D', '\u255C', '\u255B', '\u2510',
  '\u2514', '\u2534', '\u252C', '\u251C', '\u2500', '\u253C', '\u255E', '\u255F',
  '\u255A', '\u2554', '\u2569', '\u2566', '\u2560', '\u2550', '\u256C', '\u2567',
  '\u2568', '\u2564', '\u2565', '\u2559', '\u2558', '\u2552', '\u2553', '\u256B',
  '\u256A', '\u2518', '\u250C', '\u2588', '\u2584', '\u258C', '\u2590', '\u2580',
  '\u03B1', '\u00DF', '\u0393', '\u03C0', '\u03A3', '\u03C3', '\u00B5', '\u03C4',
  '\u03A6', '\u0398', '\u03A9', '\u03B4', '\u221E', '\u03C6', '\u03B5', '\u2229',
  '\u2261', '\u00B1', '\u2265', '\u2264', '\u2320', '\u2321', '\u00F7', '\u2248',
  '\u00B0', '\u2219', '\u00B7', '\u221A', '\u207F', '\u00B2', '\u25A0', '\u00A0',
];

/**
 * Reverse mapping: Unicode codepoint -> CP437 byte value.
 * Built once at module load from the CP437_TO_UNICODE table.
 * Only includes entries for bytes 0x80-0xFF (extended chars) and
 * select entries 0x01-0x1F (graphic symbols), since 0x20-0x7E are
 * standard ASCII and need no conversion.
 */
const UNICODE_TO_CP437 = new Map();
for (let byte = 0x01; byte < 0x20; byte++) {
  const ch = CP437_TO_UNICODE[byte];
  if (ch && ch.codePointAt(0) > 0x7F) {
    UNICODE_TO_CP437.set(ch, byte);
  }
}
// 0x7F -> ⌂
UNICODE_TO_CP437.set(CP437_TO_UNICODE[0x7F], 0x7F);
for (let byte = 0x80; byte <= 0xFF; byte++) {
  const ch = CP437_TO_UNICODE[byte];
  if (ch) {
    UNICODE_TO_CP437.set(ch, byte);
  }
}

/**
 * Convert a UTF-8 string to a Buffer of CP437 bytes.
 *
 * Unicode characters that have CP437 equivalents (box-drawing, block elements,
 * accented letters, etc.) are mapped back to their single-byte CP437 values.
 * ANSI escape sequences and normal ASCII are passed through as-is.
 *
 * @param {string} text - UTF-8 string (may contain ANSI escape sequences)
 * @returns {Buffer} Buffer with CP437-encoded bytes
 */
export function utf8ToCp437Buffer(text) {
  const bytes = [];

  let i = 0;
  while (i < text.length) {
    const ch = text[i];
    const code = ch.codePointAt(0);

    // Pass through ANSI CSI escape sequences as raw ASCII bytes
    if (ch === '\x1b' && i + 1 < text.length && text[i + 1] === '[') {
      bytes.push(0x1b, 0x5b);
      i += 2;
      // Read until final byte (0x40-0x7E)
      while (i < text.length) {
        const seqCode = text.charCodeAt(i);
        bytes.push(seqCode);
        i++;
        if (seqCode >= 0x40 && seqCode <= 0x7e) break;
      }
      continue;
    }

    // Standard ASCII range (includes control chars like \r, \n, \t)
    if (code <= 0x7F) {
      bytes.push(code);
      i++;
      continue;
    }

    // Check reverse map for CP437 extended characters
    const cp437Byte = UNICODE_TO_CP437.get(ch);
    if (cp437Byte !== undefined) {
      bytes.push(cp437Byte);
    } else {
      // No CP437 equivalent — emit '?' as fallback
      bytes.push(0x3F);
    }

    // Advance past the character (handle surrogate pairs for codepoints > 0xFFFF)
    i += code > 0xFFFF ? 2 : 1;
  }

  return Buffer.from(bytes);
}

export default ANSI;
