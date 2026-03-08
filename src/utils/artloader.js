/**
 * ANSI Art File Loader
 *
 * Loads .ans files from the art/ directory, parses SAUCE metadata,
 * and converts CP437 encoding to UTF-8 for terminal display.
 */
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
// Note: ansi.js has a basic cp437ToUnicode() but it only covers ~15 characters.
// We use a complete 256-entry CP437 table in cp437BufferToUtf8() below instead.

/** Project root, two levels up from src/utils/ */
const __filename = fileURLToPath(import.meta.url);
const PROJECT_ROOT = join(__filename, '..', '..', '..');
const ART_DIR = join(PROJECT_ROOT, 'art');

/** SAUCE record constants */
const SAUCE_RECORD_SIZE = 128;
const SAUCE_SIGNATURE = 'SAUCE';
const SAUCE_COMMENT_SIGNATURE = 'COMNT';
const SAUCE_COMMENT_LINE_SIZE = 64;

/**
 * Parse SAUCE metadata from the tail of a file buffer.
 *
 * SAUCE is a 128-byte record appended to the end of ANSI art files.
 * Structure (offsets from start of SAUCE record):
 *   0-4    : "SAUCE" signature (5 bytes)
 *   5-6    : Version, e.g. "00" (2 bytes)
 *   7-41   : Title (35 bytes, null-padded)
 *   42-61  : Author (20 bytes, null-padded)
 *   62-81  : Group (20 bytes, null-padded)
 *   82-89  : Date, CCYYMMDD (8 bytes)
 *   90-93  : FileSize — original file size before SAUCE was appended (4 bytes LE)
 *   94     : DataType (1 byte)
 *   95     : FileType (1 byte)
 *   96-97  : TInfo1 (2 bytes LE) — typically width
 *   98-99  : TInfo2 (2 bytes LE) — typically height
 *  100-101 : TInfo3 (2 bytes LE)
 *  102-103 : TInfo4 (2 bytes LE)
 *  104     : Comments — number of comment lines (1 byte)
 *  105     : TFlags (1 byte)
 *  106-127 : TInfoS — filler / future use (22 bytes)
 *
 * @param {Buffer} buffer - The full file buffer
 * @returns {{ sauce: object|null, contentEnd: number }}
 */
function parseSauce(buffer) {
  if (buffer.length < SAUCE_RECORD_SIZE) {
    return { sauce: null, contentEnd: buffer.length };
  }

  const sauceStart = buffer.length - SAUCE_RECORD_SIZE;
  const signature = buffer.subarray(sauceStart, sauceStart + 5).toString('ascii');

  if (signature !== SAUCE_SIGNATURE) {
    return { sauce: null, contentEnd: buffer.length };
  }

  const readStr = (offset, len) =>
    buffer.subarray(sauceStart + offset, sauceStart + offset + len)
      .toString('ascii')
      .replace(/\x00+$/, '')
      .trim();

  const sauce = {
    version: readStr(5, 2),
    title: readStr(7, 35),
    author: readStr(42, 20),
    group: readStr(62, 20),
    date: readStr(82, 8),
    fileSize: buffer.readUInt32LE(sauceStart + 90),
    dataType: buffer.readUInt8(sauceStart + 94),
    fileType: buffer.readUInt8(sauceStart + 95),
    tInfo1: buffer.readUInt16LE(sauceStart + 96),
    tInfo2: buffer.readUInt16LE(sauceStart + 98),
    tInfo3: buffer.readUInt16LE(sauceStart + 100),
    tInfo4: buffer.readUInt16LE(sauceStart + 102),
    comments: [],
    tFlags: buffer.readUInt8(sauceStart + 105),
  };

  // Parse comment block if present
  const commentCount = buffer.readUInt8(sauceStart + 104);
  if (commentCount > 0) {
    const commentBlockSize = 5 + (commentCount * SAUCE_COMMENT_LINE_SIZE);
    const commentStart = sauceStart - commentBlockSize;

    if (commentStart >= 0) {
      const commentSig = buffer.subarray(commentStart, commentStart + 5).toString('ascii');
      if (commentSig === SAUCE_COMMENT_SIGNATURE) {
        for (let i = 0; i < commentCount; i++) {
          const lineStart = commentStart + 5 + (i * SAUCE_COMMENT_LINE_SIZE);
          const line = buffer.subarray(lineStart, lineStart + SAUCE_COMMENT_LINE_SIZE)
            .toString('ascii')
            .replace(/\x00+$/, '')
            .trim();
          sauce.comments.push(line);
        }
      }
    }
  }

  // Content ends before any comment block or SAUCE record
  let contentEnd = sauceStart;
  if (commentCount > 0) {
    const commentBlockSize = 5 + (commentCount * SAUCE_COMMENT_LINE_SIZE);
    const commentStart = sauceStart - commentBlockSize;
    if (commentStart >= 0) {
      const commentSig = buffer.subarray(commentStart, commentStart + 5).toString('ascii');
      if (commentSig === SAUCE_COMMENT_SIGNATURE) {
        contentEnd = commentStart;
      }
    }
  }

  // Strip trailing EOF marker (0x1A / SUB) that often precedes SAUCE
  if (contentEnd > 0 && buffer.readUInt8(contentEnd - 1) === 0x1a) {
    contentEnd--;
  }

  return { sauce, contentEnd };
}

/**
 * Convert a raw CP437 buffer to a UTF-8 string.
 *
 * Preserves ANSI escape sequences (CSI codes) while mapping
 * non-control CP437 byte values through cp437ToUnicode.
 *
 * @param {Buffer} buffer - Raw CP437 content bytes
 * @returns {string} UTF-8 string ready for terminal display
 */
function cp437BufferToUtf8(buffer) {
  // Full CP437 table (indices 0-255)
  const CP437 = [
    '\u0000', '\u263A', '\u263B', '\u2665', '\u2666', '\u2663', '\u2660', '\u2022',
    '\u25D8', '\u25CB', '\u25D9', '\u2642', '\u2640', '\u266A', '\u266B', '\u263C',
    '\u25BA', '\u25C4', '\u2195', '\u203C', '\u00B6', '\u00A7', '\u25AC', '\u21A8',
    '\u2191', '\u2193', '\u2192', '\u001B', '\u221F', '\u2194', '\u25B2', '\u25BC',
    // 0x20-0x7E: standard ASCII (handled inline below)
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

  let result = '';
  let i = 0;

  while (i < buffer.length) {
    const byte = buffer[i];

    // Preserve ESC sequences — pass through until end of CSI sequence
    if (byte === 0x1b && i + 1 < buffer.length && buffer[i + 1] === 0x5b) {
      // CSI sequence: ESC [ ... <final byte 0x40-0x7E>
      result += '\x1b[';
      i += 2;
      while (i < buffer.length) {
        const ch = buffer[i];
        result += String.fromCharCode(ch);
        i++;
        if (ch >= 0x40 && ch <= 0x7e) break;
      }
      continue;
    }

    // Preserve common control characters
    if (byte === 0x0a || byte === 0x0d || byte === 0x09) {
      result += String.fromCharCode(byte);
      i++;
      continue;
    }

    // Map through CP437 table
    result += CP437[byte] || String.fromCharCode(byte);
    i++;
  }

  return result;
}

/**
 * Load a single .ans file from the art/ directory.
 *
 * @param {string} filename - File name (e.g. "welcome.ans")
 * @returns {Promise<{ content: string, sauce: object|null }>}
 */
export async function loadArt(filename) {
  const filePath = join(ART_DIR, filename);
  const buffer = await readFile(filePath);

  const { sauce, contentEnd } = parseSauce(buffer);
  const contentBuffer = buffer.subarray(0, contentEnd);
  const content = cp437BufferToUtf8(contentBuffer);

  return { content, sauce };
}

/**
 * Send ANSI art directly to a telnet connection.
 *
 * @param {object} connection - Object with a write() method (socket or BBSScreen)
 * @param {string} filename   - File name (e.g. "welcome.ans")
 * @returns {Promise<{ sauce: object|null }>}
 */
export async function displayArt(connection, filename) {
  const { content, sauce } = await loadArt(filename);
  connection.write(content);
  return { sauce };
}

/**
 * List available .ans files in the art/ directory.
 *
 * @returns {Promise<string[]>} Array of filenames
 */
export async function listArt() {
  let entries;
  try {
    entries = await readdir(ART_DIR);
  } catch (err) {
    if (err.code === 'ENOENT') return [];
    throw err;
  }

  return entries
    .filter(name => extname(name).toLowerCase() === '.ans')
    .sort();
}
