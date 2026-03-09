/**
 * File Area Service
 *
 * Provides file browsing, ZMODEM download/upload (telnet/SSH via lrzsz),
 * HTTP download links (web), FILE_ID.DIZ extraction, new-files scan,
 * and configurable download ratios.
 */
import getDatabase from '../database/db.js';
import { colorText, BOX, padText } from '../utils/ansi.js';
import config from '../config/index.js';
import { existsSync, statSync, mkdirSync, readdirSync } from 'fs';
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

      const menuItems = areas.map((area, idx) => ({
        key: (idx + 1).toString(),
        text: `${area.name} (${area.file_count} files)`,
      }));

      menuItems.push({ key: 'N', text: 'New Files Scan' });
      menuItems.push({ key: 'Q', text: 'Return to Main Menu' });

      this.screen.menu('FILE AREAS', menuItems, 'Area');

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

      let prompt = '[V]iew  ';
      if (config.features.allowDownloads) prompt += '[D]ownload  ';
      if (config.features.allowUploads) prompt += '[U]pload  ';
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
      } else if (choice === 'U' && config.features.allowUploads) {
        await this.uploadFile(area);
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

    // Resolve the file path on disk
    const areaPath = join(config.paths.downloads, area.path);
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
      await this._spawnZmodem('sz', [filePath]);
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

    // Ensure the area directory exists
    const areaPath = join(config.paths.downloads, area.path);
    if (!existsSync(areaPath)) {
      mkdirSync(areaPath, { recursive: true });
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('Starting ZMODEM receive. Begin your transfer now.', 'yellow', null, true) + '\r\n\r\n');

    // Snapshot directory contents before upload to detect new files
    const beforeFiles = new Set(existsSync(areaPath) ? readdirSync(areaPath) : []);

    try {
      await this._spawnZmodem('rz', ['-e'], areaPath);

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

      // Pipe child stdout -> user socket (ZMODEM data to terminal)
      child.stdout.on('data', (data) => {
        try {
          socket.write(data);
        } catch {
          // Socket may have closed
        }
      });

      // Pipe child stderr -> user socket (progress/status)
      child.stderr.on('data', (data) => {
        try {
          socket.write(data);
        } catch {
          // Socket may have closed
        }
      });

      // Pipe user socket -> child stdin (ZMODEM data from terminal)
      const onData = (data) => {
        try {
          child.stdin.write(data);
        } catch {
          // Child may have exited
        }
      };
      socket.on('data', onData);

      child.on('close', (code) => {
        // Remove our data listener so normal input handling resumes
        socket.removeListener('data', onData);

        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`${cmd} exited with code ${code}`));
        }
      });

      child.on('error', (err) => {
        socket.removeListener('data', onData);
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
