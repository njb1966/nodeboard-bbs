/**
 * File Area Service
 *
 * Provides file browsing, ZMODEM download/upload (telnet/SSH via lrzsz),
 * HTTP download links (web), FILE_ID.DIZ extraction, new-files scan,
 * and configurable download ratios.
 */
import getDatabase from '../database/db.js';
import { colorText, BOX, padText } from '../utils/ansi.js';
import { loadArt, applyAtCodes } from '../utils/artloader.js';
import config from '../config/index.js';
import { existsSync, statSync, mkdirSync, readdirSync, unlinkSync, renameSync } from 'fs';
import { join, basename, extname } from 'path';
import { spawn, execFileSync } from 'child_process';
import { generateDownloadToken } from './DownloadTokenService.js';
import { logEvent } from './LogService.js';

export class FileService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  // ───────────────────────────── Area browser ─────────────────────────────

  /**
   * Show file areas
   */
  async show() {
    while (true) {
      const db = getDatabase();
      const areas = db.prepare(`
        SELECT * FROM file_areas
        WHERE security_level <= ?
        ORDER BY id
      `).all(this.user.security_level);

      // Try to display files.ans with @AREAS@ substitution; fall back to code-rendered menu
      let artDisplayed = false;
      try {
        const { content } = await loadArt('files.ans');
        // @AREAS@ sits after ESC[22C in the art, so line 1 starts at col 22.
        // Lines 2+ must be prefixed with 22 spaces to stay aligned.
        // Keep content ≤ 56 chars so nothing wraps past col 80.
        const indent = ' '.repeat(13);
        const areaLines = areas.map((area, idx) => {
          const num = String(idx + 1).padStart(2);
          const name = area.name.substring(0, 16).padEnd(16);
          const desc = (area.description || '').substring(0, 22).padEnd(22);
          const count = `(${area.file_count} files)`;
          const line = `${num}. ${name}  ${desc}  ${count}`;
          return idx === 0 ? line : `${indent}${line}`;
        });
        areaLines.push('');
        areaLines.push(`${indent}\x1b[1;33mN\x1b[0;36m. New Files Scan\x1b[0m`);
        areaLines.push(`${indent}\x1b[1;33mQ\x1b[0;36m. Return to Main Menu\x1b[0m`);
        const processed = applyAtCodes(content, {
          username: this.user.username,
          node: this.connection.nodeNumber ?? '?',
          bbsName: config.bbs.name,
          areas: areaLines,
        });
        this.screen.clear();
        this.connection.write(processed);
        this.connection.write('\r\n' + colorText('Area: ', 'yellow', null, true));
        artDisplayed = true;
      } catch (err) { console.error('[FileService] art render error:', err); }

      if (!artDisplayed) {
        const menuItems = areas.map((area, idx) => ({
          key: (idx + 1).toString(),
          text: `${area.name} (${area.file_count} files)`,
        }));
        menuItems.push({ key: 'N', text: 'New Files Scan' });
        menuItems.push({ key: 'Q', text: 'Return to Main Menu' });
        this.screen.menu('FILE AREAS', menuItems, 'Area');
      }

      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q') {
        return;
      } else if (choice === 'N') {
        await this.newFilesScan();
      } else {
        const areaIdx = parseInt(choice) - 1;
        if (areaIdx >= 0 && areaIdx < areas.length) {
          await this.showArea(areas[areaIdx]);
        }
      }
    }
  }

  /**
   * Show files in area
   */
  async showArea(area) {
    while (true) {
      const db = getDatabase();
      const files = db.prepare(`
        SELECT * FROM files
        WHERE area_id = ?
        ORDER BY created_at DESC
        LIMIT 50
      `).all(area.id);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText(`File Area: ${area.name}`, 'yellow', null, true) + '\r\n');

      // Show ratio info when enabled
      if (config.files.ratioEnabled) {
        const ratio = this._getUserRatio();
        const maxRatio = config.files.downloadRatio;
        const exempt = this.user.security_level >= config.files.exemptLevel;
        const ratioColor = exempt ? 'green' : (ratio > maxRatio ? 'red' : 'green');
        const ratioStr = exempt
          ? 'Exempt'
          : `${ratio.toFixed(1)}:1 (max ${maxRatio}:1)`;
        this.connection.write(
          colorText(`D/L Ratio: `, 'cyan') +
          colorText(ratioStr, ratioColor, null, true) +
          '\r\n'
        );
      }

      this.connection.write(colorText('-'.repeat(80), 'cyan') + '\r\n');

      if (files.length === 0) {
        this.connection.write(colorText('No files in this area.', 'white') + '\r\n\r\n');
      } else {
        files.forEach((file, idx) => {
          const size = this.formatFileSize(file.file_size);
          const date = new Date(file.created_at).toLocaleDateString();

          this.connection.write(
            colorText(`[${idx + 1}] `, 'green', null, true) +
            colorText(file.original_name, 'white') +
            colorText(` (${size})`, 'cyan') +
            '\r\n' +
            colorText(`    ${file.description || 'No description'}`, 'white') +
            colorText(` - by ${file.uploader_name} on ${date} - ${file.download_count} downloads`, 'cyan') +
            '\r\n'
          );
        });
      }

      this.connection.write('\r\n');

      const isSysop = this.user.security_level >= 90;
      const canUpload = config.features.allowUploads &&
        (isSysop || area.allow_uploads);

      let prompt = '[V]iew  ';
      if (config.features.allowDownloads) prompt += '[D]ownload  ';
      if (canUpload) prompt += '[U]pload  ';
      if (isSysop && files.length > 0) prompt += '[R]emove  [M]ove  ';
      prompt += '[Q]uit: ';

      this.connection.write(colorText(prompt, 'yellow', null, true));

      const choice = (await this.connection.getInput()).toUpperCase();

      if (choice === 'Q') {
        return;
      } else if (choice === 'V') {
        const fileNum = await this.connection.getInput('File number: ');
        const idx = parseInt(fileNum) - 1;
        if (idx >= 0 && idx < files.length) {
          await this.viewFile(files[idx]);
        }
      } else if (choice === 'D' && config.features.allowDownloads) {
        const fileNum = await this.connection.getInput('File number to download: ');
        const idx = parseInt(fileNum) - 1;
        if (idx >= 0 && idx < files.length) {
          await this.downloadFile(files[idx], area);
        }
      } else if (choice === 'U' && canUpload) {
        await this.uploadFile(area);
      } else if (choice === 'R' && isSysop && files.length > 0) {
        const fileNum = await this.connection.getInput('File number to remove: ');
        const idx = parseInt(fileNum) - 1;
        if (idx >= 0 && idx < files.length) {
          await this.removeFile(files[idx], area);
        }
      } else if (choice === 'M' && isSysop && files.length > 0) {
        const fileNum = await this.connection.getInput('File number to move: ');
        const idx = parseInt(fileNum) - 1;
        if (idx >= 0 && idx < files.length) {
          await this.moveFile(files[idx], area);
        }
      }
    }
  }

  /**
   * View file details
   */
  async viewFile(file) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n');
    this.connection.write(colorText(`File: ${file.original_name}`, 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(`Size: ${this.formatFileSize(file.file_size)}`, 'white') + '\r\n');
    this.connection.write(colorText(`Uploader: ${file.uploader_name}`, 'white') + '\r\n');
    this.connection.write(colorText(`Uploaded: ${new Date(file.created_at).toLocaleString()}`, 'white') + '\r\n');
    this.connection.write(colorText(`Downloads: ${file.download_count}`, 'white') + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan', null, true) + '\r\n\r\n');
    this.connection.write(colorText('Description:', 'yellow', null, true) + '\r\n');
    this.connection.write((file.description || 'No description') + '\r\n\r\n');

    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  // ───────────────────────── Sysop File Management ─────────────────────────

  async removeFile(file, area) {
    this.connection.write('\r\n');
    this.connection.write(colorText(`Remove: ${file.original_name} — are you sure? (Y/N): `, 'yellow', null, true));
    const confirm = (await this.connection.getInput()).toUpperCase();
    if (confirm !== 'Y') {
      this.connection.write(colorText('  Cancelled.\r\n', 'white'));
      return;
    }

    const filePath = join(config.paths.root, 'data', 'downloads', area.path, file.filename);
    const db = getDatabase();

    try {
      if (existsSync(filePath)) unlinkSync(filePath);
      db.prepare('DELETE FROM files WHERE id = ?').run(file.id);
      db.prepare('UPDATE file_areas SET file_count = MAX(0, file_count - 1) WHERE id = ?').run(area.id);
      logEvent('FILE', this.user.id, this.user.username, `Deleted file: ${file.original_name}`, this.connection.remoteAddress);
      this.connection.write(colorText(`  ${file.original_name} deleted.\r\n`, 'green', null, true));
    } catch (err) {
      this.connection.write(colorText(`  Error: ${err.message}\r\n`, 'red', null, true));
    }

    await this.connection.getChar();
  }

  async moveFile(file, fromArea) {
    const db = getDatabase();
    const areas = db.prepare('SELECT * FROM file_areas WHERE id != ? ORDER BY name').all(fromArea.id);

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText(`  Move: ${file.original_name}\r\n`, 'yellow', null, true));
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(55), 'cyan', null, true) + '\r\n\r\n');

    areas.forEach((a, i) => {
      this.connection.write(
        colorText(`  [${i + 1}] `, 'green', null, true) +
        colorText(a.name, 'white') + '\r\n'
      );
    });

    this.connection.write('\r\n');
    const choice = await this.connection.getInput('  Destination area (or ENTER to cancel): ');
    if (!choice) return;

    const idx = parseInt(choice) - 1;
    if (idx < 0 || idx >= areas.length) {
      this.connection.write(colorText('  Invalid selection.\r\n', 'red'));
      await this.connection.getChar();
      return;
    }

    const toArea = areas[idx];
    const fromPath = join(config.paths.root, 'data', 'downloads', fromArea.path, file.filename);
    const toDir   = join(config.paths.root, 'data', 'downloads', toArea.path);
    const toPath  = join(toDir, file.filename);

    try {
      if (!existsSync(toDir)) mkdirSync(toDir, { recursive: true });
      renameSync(fromPath, toPath);
      db.prepare('UPDATE files SET area_id = ? WHERE id = ?').run(toArea.id, file.id);
      db.prepare('UPDATE file_areas SET file_count = MAX(0, file_count - 1) WHERE id = ?').run(fromArea.id);
      db.prepare('UPDATE file_areas SET file_count = file_count + 1 WHERE id = ?').run(toArea.id);
      logEvent('FILE', this.user.id, this.user.username, `Moved ${file.original_name} → ${toArea.name}`, this.connection.remoteAddress);
      this.connection.write(colorText(`\r\n  Moved to ${toArea.name}.\r\n`, 'green', null, true));
    } catch (err) {
      this.connection.write(colorText(`  Error: ${err.message}\r\n`, 'red', null, true));
    }

    await this.connection.getChar();
  }

  // ───────────────────────────── Downloads ─────────────────────────────

  /**
   * Download a file.
   * - Web users get a temporary HTTP download link.
   * - Telnet/SSH users get a ZMODEM transfer via the external `sz` command.
   */
  async downloadFile(file, area) {
    // --- Ratio check ---
    if (!(await this._checkRatio())) {
      return;
    }

    // Resolve the file path on disk — use config.paths.root to guarantee an
    // absolute path so sz/rz receive a valid location regardless of CWD.
    const areaPath = join(config.paths.root, 'data', 'downloads', area.path);
    const filePath = join(areaPath, file.filename);

    if (!existsSync(filePath)) {
      this.connection.write('\r\n');
      this.connection.write(colorText('Error: File not found on disk. Contact the sysop.', 'red', null, true) + '\r\n');
      this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return;
    }

    const protocol = this.connection.protocol;

    if (protocol === 'web') {
      // --- Web: generate HTTP download token ---
      await this._downloadViaHttp(file, filePath);
    } else {
      // --- Telnet / SSH: ZMODEM via sz ---
      await this._downloadViaZmodem(file, filePath);
    }
  }

  /**
   * Generate and display an HTTP download link for web users.
   */
  async _downloadViaHttp(file, filePath) {
    const url = generateDownloadToken(filePath, file.original_name, this.user.id);

    this.connection.write('\r\n');
    this.connection.write(colorText('Download Link (expires in 5 minutes):', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(url, 'cyan', null, true) + '\r\n\r\n');
    this.connection.write(colorText('Copy the URL above and open it in your browser.', 'white') + '\r\n');

    // Increment counters
    this._recordDownload(file);

    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * Perform a ZMODEM download using the external `sz` command (lrzsz package).
   */
  async _downloadViaZmodem(file, filePath) {
    // Check if sz is available
    if (!this._hasSz()) {
      // Fallback: show HTTP download link
      this.connection.write('\r\n');
      this.connection.write(colorText('ZMODEM not available. Install the lrzsz package or use the web interface.', 'yellow', null, true) + '\r\n');

      const url = generateDownloadToken(filePath, file.original_name, this.user.id);
      this.connection.write(colorText('Download URL: ', 'white') + colorText(url, 'cyan', null, true) + '\r\n');
      this.connection.write(colorText('(expires in 5 minutes)', 'white') + '\r\n\r\n');

      this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return;
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('Starting ZMODEM transfer. Make sure your terminal supports ZMODEM.', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(`Sending: ${file.original_name} (${this.formatFileSize(file.file_size)})`, 'white') + '\r\n\r\n');

    try {
      await this._spawnZmodem('sz', ['-y', filePath]);
      this._recordDownload(file);
      this.connection.write('\r\n');
      this.connection.write(colorText('Transfer complete!', 'green', null, true) + '\r\n');
    } catch (err) {
      this.connection.write('\r\n');
      this.connection.write(colorText(`Transfer failed: ${err.message}`, 'red', null, true) + '\r\n');
    }

    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  // ───────────────────────────── Uploads ─────────────────────────────

  /**
   * Upload a file to the given area.
   * - Web users are told to use the web upload form (future).
   * - Telnet/SSH users get a ZMODEM receive via `rz`.
   */
  async uploadFile(area) {
    const protocol = this.connection.protocol;

    if (protocol === 'web') {
      this.connection.write('\r\n');
      this.connection.write(colorText('File upload via the web terminal is not yet supported.', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('Please use a telnet or SSH client with ZMODEM support.', 'white') + '\r\n');
      this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return;
    }

    // Check if rz is available
    if (!this._hasRz()) {
      this.connection.write('\r\n');
      this.connection.write(colorText('ZMODEM not available. Install the lrzsz package to enable uploads.', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return;
    }

    // Prompt for description before transfer
    this.connection.write('\r\n');
    const description = await this.connection.getInput('File description (or ENTER for none): ');

    // Ensure the area directory exists — absolute path required for rz
    const areaPath = join(config.paths.root, 'data', 'downloads', area.path);
    if (!existsSync(areaPath)) {
      mkdirSync(areaPath, { recursive: true });
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('Starting ZMODEM receive. Begin your transfer now.', 'yellow', null, true) + '\r\n\r\n');

    // Snapshot directory contents before upload to detect new files
    const beforeFiles = new Set(existsSync(areaPath) ? readdirSync(areaPath) : []);

    try {
      await this._spawnZmodem('rz', ['-b'], areaPath);

      // Detect newly uploaded file(s) by diffing directory
      const afterFiles = readdirSync(areaPath);
      const newFiles = afterFiles.filter(f => !beforeFiles.has(f));

      if (newFiles.length === 0) {
        this.connection.write('\r\n');
        this.connection.write(colorText('No files received.', 'yellow', null, true) + '\r\n');
      } else {
        const db = getDatabase();

        for (const filename of newFiles) {
          const filePath = join(areaPath, filename);
          const stat = statSync(filePath);

          // Try FILE_ID.DIZ extraction if no description was given
          let fileDesc = description || null;
          if (!fileDesc) {
            const diz = this.extractFileIdDiz(filePath);
            if (diz) fileDesc = diz;
          }

          // Insert into database
          db.prepare(`
            INSERT INTO files (area_id, filename, original_name, description, uploader_id, uploader_name, file_size)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `).run(area.id, filename, filename, fileDesc, this.user.id, this.user.username, stat.size);

          // Update area file count
          db.prepare('UPDATE file_areas SET file_count = file_count + 1 WHERE id = ?').run(area.id);

          // Update user upload count
          this.user.incrementUploads();
          this.user.uploads = (this.user.uploads || 0) + 1;
          logEvent('FILE', this.user.id, this.user.username, `Uploaded: ${filename} (${this.formatFileSize(stat.size)})`, this.connection.remoteAddress);

          this.connection.write('\r\n');
          this.connection.write(
            colorText('Received: ', 'green', null, true) +
            colorText(filename, 'white') +
            colorText(` (${this.formatFileSize(stat.size)})`, 'cyan') +
            '\r\n'
          );
        }

        this.connection.write(colorText('Upload complete!', 'green', null, true) + '\r\n');
      }
    } catch (err) {
      this.connection.write('\r\n');
      this.connection.write(colorText(`Upload failed: ${err.message}`, 'red', null, true) + '\r\n');
    }

    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  // ───────────────────────── ZMODEM helpers ─────────────────────────

  /**
   * Check if the `sz` (send ZMODEM) command is available on the system.
   */
  _hasSz() {
    try {
      execFileSync('which', ['sz'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Check if the `rz` (receive ZMODEM) command is available on the system.
   */
  _hasRz() {
    try {
      execFileSync('which', ['rz'], { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Spawn a ZMODEM process (sz or rz) and pipe its I/O to the user's socket.
   *
   * @param {string} cmd   - 'sz' or 'rz'
   * @param {string[]} args - arguments (file path for sz, flags for rz)
   * @param {string} [cwd]  - working directory (used by rz to place received files)
   * @returns {Promise<void>}
   */
  _spawnZmodem(cmd, args, cwd) {
    return new Promise((resolve, reject) => {
      const child = spawn(cmd, args, {
        cwd: cwd || undefined,
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      const socket = this.connection.socket;

      // Suspend the connection's normal data handler so it doesn't echo or
      // interpret binary ZMODEM packets as BBS input, which corrupts the stream.
      this.connection.rawMode = true;

      // Pipe child stdout -> user socket (ZMODEM protocol frames to terminal).
      // rz sends raw XON (0x11) / XOFF (0x13) flow control bytes on stdout as
      // part of the ZMODEM protocol. On a serial/modem link these are absorbed
      // by the line driver; on a direct TCP socket they reach the sender as
      // unexpected out-of-band bytes, corrupting the data stream and causing
      // CRC failures. Strip them before forwarding — all ZMODEM control frames
      // sent by rz (ZRINIT, ZRPOS, ZACK, ZFIN) are HEX-encoded ASCII and
      // never legitimately contain 0x11 or 0x13.
      child.stdout.on('data', (data) => {
        try {
          let out = data;
          if (data.includes(0x11) || data.includes(0x13)) {
            const bytes = [];
            for (let i = 0; i < data.length; i++) {
              if (data[i] !== 0x11 && data[i] !== 0x13) bytes.push(data[i]);
            }
            out = Buffer.from(bytes);
          }
          // For Telnet, re-escape any 0xFF bytes in rz's output so
          // SyncTERM's Telnet parser doesn't treat them as IAC commands.
          if (this.connection.protocol === 'telnet' && out.includes(0xFF)) {
            const escaped = [];
            for (let i = 0; i < out.length; i++) {
              escaped.push(out[i]);
              if (out[i] === 0xFF) escaped.push(0xFF);
            }
            out = Buffer.from(escaped);
          }
          if (out.length > 0) socket.write(out);
        } catch {
          // Socket may have closed
        }
      });

      // Log stderr server-side only — do NOT send to socket during binary transfer
      // as it pollutes the ZMODEM binary stream and confuses the client parser.
      child.stderr.on('data', (data) => {
        process.stderr.write(`[${cmd}] ${data}`);
      });

      // Pipe raw socket data -> child stdin.
      // For Telnet connections SyncTERM escapes 0xFF as 0xFF 0xFF (IAC IAC).
      // We must un-escape before handing data to rz or rz sees doubled 0xFF
      // bytes in ZMODEM binary frames and fails every CRC check.
      //
      // IMPORTANT: 0xFF 0xFF pairs can be split across TCP chunks. We carry
      // an incomplete leading 0xFF forward into the next chunk to handle this.
      let iacCarry = false; // true when last byte of previous chunk was 0xFF

      const unescapeTelnet = (buf) => {
        const out = [];
        let i = 0;

        // Resume from a 0xFF carried over from the previous chunk
        if (iacCarry) {
          iacCarry = false;
          if (buf.length > 0) {
            const next = buf[0];
            if (next === 0xFF) {
              out.push(0xFF); // 0xFF 0xFF → literal 0xFF
            } else if (next >= 251 && next <= 254) {
              i = 2; // IAC WILL/WONT/DO/DONT + option — skip
            } else if (next === 250) {
              // IAC SB ... IAC SE
              i = 2;
              while (i < buf.length && buf[i] !== 240) i++;
              i++;
            }
            // else: unknown IAC — skip the pair
            if (i === 0) i = 1; // consumed the carry + next byte
          }
        }

        for (; i < buf.length; i++) {
          if (buf[i] !== 0xFF) {
            out.push(buf[i]);
            continue;
          }
          // buf[i] === 0xFF
          if (i + 1 >= buf.length) {
            iacCarry = true; // split pair — hold and wait for next chunk
            break;
          }
          const next = buf[i + 1];
          if (next === 0xFF) {
            out.push(0xFF); // IAC IAC → literal 0xFF
            i++;
          } else if (next >= 251 && next <= 254) {
            i += 2; // IAC WILL/WONT/DO/DONT + option
          } else if (next === 250) {
            i += 2;
            while (i < buf.length && buf[i] !== 240) i++;
          } else {
            i++; // unknown IAC command
          }
        }
        return Buffer.from(out);
      };

      const onData = (data) => {
        try {
          const input = this.connection.protocol === 'telnet'
            ? unescapeTelnet(data)
            : data;
          if (input.length > 0) child.stdin.write(input);
        } catch {
          // Child may have exited
        }
      };
      socket.on('data', onData);

      child.on('close', (code) => {
        socket.removeListener('data', onData);
        this.connection.rawMode = false;

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${cmd} exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        socket.removeListener('data', onData);
        this.connection.rawMode = false;
        reject(err);
      });
    });
  }

  // ───────────────────────── FILE_ID.DIZ ─────────────────────────

  /**
   * Extract FILE_ID.DIZ from a ZIP archive.
   * Uses the system `unzip` command to avoid adding a Node dependency.
   *
   * @param {string} filePath - absolute path to the file
   * @returns {string|null} contents of FILE_ID.DIZ, or null
   */
  extractFileIdDiz(filePath) {
    // Only attempt extraction for .zip files
    const ext = extname(filePath).toLowerCase();
    if (ext !== '.zip') return null;

    try {
      // List files in the archive and look for FILE_ID.DIZ (case-insensitive)
      const listing = execFileSync('unzip', ['-l', filePath], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      }).toString();

      // Find the actual name of FILE_ID.DIZ inside the archive (may differ in case)
      const match = listing.match(/\s([\w/]*FILE_ID\.DIZ)\s*/i);
      if (!match) return null;

      const dizName = match[1].trim();

      // Extract to stdout
      const content = execFileSync('unzip', ['-p', filePath, dizName], {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 5000,
      }).toString().trim();

      return content || null;
    } catch {
      return null;
    }
  }

  // ───────────────────────── New Files Scan ─────────────────────────

  /**
   * Scan for files uploaded since the user's last login.
   */
  async newFilesScan() {
    const db = getDatabase();
    const lastLogin = this.user.last_login;

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('New Files Since Your Last Visit', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText(BOX.HORIZONTAL.repeat(40), 'cyan') + '\r\n');

    if (!lastLogin) {
      this.connection.write(colorText('This is your first visit -- all files are new!', 'white') + '\r\n\r\n');
      this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return;
    }

    // Count new files per area
    const areas = db.prepare(`
      SELECT fa.id, fa.name,
        (SELECT COUNT(*) FROM files f WHERE f.area_id = fa.id AND f.created_at > ?) as new_count
      FROM file_areas fa
      WHERE fa.security_level <= ?
      ORDER BY fa.id
    `).all(lastLogin, this.user.security_level);

    const totalNew = areas.reduce((sum, a) => sum + a.new_count, 0);

    if (totalNew === 0) {
      this.connection.write(colorText('No new files since your last visit.', 'white') + '\r\n\r\n');
      this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return;
    }

    for (const area of areas) {
      if (area.new_count > 0) {
        this.connection.write(
          colorText(`  ${padText(area.name + ':', 25)}`, 'white') +
          colorText(`${area.new_count} new file${area.new_count !== 1 ? 's' : ''}`, 'green', null, true) +
          '\r\n'
        );
      }
    }

    this.connection.write(colorText(BOX.HORIZONTAL.repeat(40), 'cyan') + '\r\n');
    this.connection.write(colorText(`  Total: ${totalNew} new file${totalNew !== 1 ? 's' : ''}`, 'yellow', null, true) + '\r\n\r\n');
    this.connection.write(colorText('[L]ist new files  [Q]uit: ', 'yellow', null, true));

    const choice = (await this.connection.getInput()).toUpperCase();

    if (choice === 'L') {
      await this._listNewFiles(lastLogin);
    }
  }

  /**
   * List all new files since the given timestamp.
   */
  async _listNewFiles(sinceDate) {
    const db = getDatabase();

    const files = db.prepare(`
      SELECT f.*, fa.name as area_name
      FROM files f
      JOIN file_areas fa ON fa.id = f.area_id
      WHERE f.created_at > ? AND fa.security_level <= ?
      ORDER BY f.created_at DESC
    `).all(sinceDate, this.user.security_level);

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('New Files Listing', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('='.repeat(80), 'cyan') + '\r\n');

    for (const file of files) {
      const size = this.formatFileSize(file.file_size);
      const date = new Date(file.created_at).toLocaleDateString();

      this.connection.write(
        colorText(`[${file.area_name}] `, 'cyan', null, true) +
        colorText(file.original_name, 'white') +
        colorText(` (${size})`, 'cyan') +
        colorText(` by ${file.uploader_name} on ${date}`, 'white') +
        '\r\n' +
        colorText(`  ${file.description || 'No description'}`, 'white') +
        '\r\n'
      );
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  // ───────────────────────── Ratio enforcement ─────────────────────────

  /**
   * Calculate the user's current download-to-upload ratio.
   * @returns {number}
   */
  _getUserRatio() {
    const uploads = Math.max(this.user.uploads || 0, 1);
    return (this.user.downloads || 0) / uploads;
  }

  /**
   * Check whether the user is allowed to download based on ratio settings.
   * Displays a message and returns false if denied.
   * @returns {Promise<boolean>}
   */
  async _checkRatio() {
    if (!config.files.ratioEnabled) return true;

    // Sysops / high-level users are exempt
    if (this.user.security_level >= config.files.exemptLevel) return true;

    const ratio = this._getUserRatio();
    const maxRatio = config.files.downloadRatio;

    if (ratio >= maxRatio) {
      this.connection.write('\r\n');
      this.connection.write(colorText('Download ratio exceeded!', 'red', null, true) + '\r\n');
      this.connection.write(colorText(
        `You must upload more files. Current ratio: ${ratio.toFixed(1)}:1 (max: ${maxRatio}:1)`,
        'yellow'
      ) + '\r\n\r\n');
      this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return false;
    }

    return true;
  }

  /**
   * Record a successful download: bump DB counters and in-memory user object.
   */
  _recordDownload(file) {
    const db = getDatabase();
    db.prepare('UPDATE files SET download_count = download_count + 1 WHERE id = ?').run(file.id);
    this.user.incrementDownloads();
    this.user.downloads = (this.user.downloads || 0) + 1;
    logEvent('FILE', this.user.id, this.user.username, `Downloaded: ${file.original_name}`, this.connection.remoteAddress);
  }

  // ───────────────────────────── Utilities ─────────────────────────────

  /**
   * Format file size
   */
  formatFileSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
  }
}

export default FileService;
