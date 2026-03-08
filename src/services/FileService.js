/**
 * File Area Service
 */
import getDatabase from '../database/db.js';
import { colorText } from '../utils/ansi.js';
import config from '../config/index.js';
import { createReadStream, createWriteStream, existsSync, statSync, unlinkSync } from 'fs';
import { join } from 'path';
import { v4 as uuidv4 } from 'uuid';

export class FileService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

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

      menuItems.push({ key: 'Q', text: 'Return to Main Menu' });

      this.screen.menu('FILE AREAS', menuItems, 'Area');

      const choice = await this.connection.getInput();

      if (choice.toUpperCase() === 'Q') {
        return;
      }

      const areaIdx = parseInt(choice) - 1;
      if (areaIdx >= 0 && areaIdx < areas.length) {
        await this.showArea(areas[areaIdx]);
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
        this.screen.messageBox('Info', 'File download via telnet is not yet implemented. Use the web interface to download files.', 'info');
        await this.connection.getChar();
      } else if (choice === 'U' && config.features.allowUploads) {
        this.screen.messageBox('Info', 'File upload via telnet is not yet implemented. Use the web interface to upload files.', 'info');
        await this.connection.getChar();
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
    this.connection.write(file.description || 'No description' + '\r\n\r\n');

    this.connection.write(colorText('Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

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
