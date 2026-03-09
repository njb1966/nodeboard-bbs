/**
 * Configuration Management
 */
import { config as dotenvConfig } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

// Load environment variables
dotenvConfig();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const rootDir = join(__dirname, '../..');

export const config = {
  // BBS Settings
  bbs: {
    name: process.env.BBS_NAME || 'NodeBoard BBS',
    sysop: process.env.BBS_SYSOP || 'Sysop',
    version: '1.1.0',
    port: parseInt(process.env.BBS_PORT || '2323'),
    maxConnections: parseInt(process.env.MAX_CONNECTIONS || '50'),
  },

  // SSH Server Settings
  ssh: {
    enabled: process.env.SSH_ENABLED !== 'false',
    port: parseInt(process.env.SSH_PORT || '2222'),
    hostKeyPath: process.env.SSH_HOST_KEY_PATH || join(rootDir, 'data/ssh_host_key'),
  },

  // Web Server Settings
  web: {
    enabled: true,
    port: parseInt(process.env.WEB_PORT || '3000'),
  },

  // Database
  database: {
    path: process.env.DB_PATH || join(rootDir, 'data/bbs.db'),
  },

  // Paths
  paths: {
    root: rootDir,
    data: join(rootDir, 'data'),
    uploads: process.env.UPLOAD_PATH || join(rootDir, 'data/uploads'),
    downloads: process.env.DOWNLOAD_PATH || join(rootDir, 'data/downloads'),
    doors: process.env.DOOR_PATH || join(rootDir, 'doors'),
    logs: join(rootDir, 'logs'),
  },

  // Session settings
  session: {
    timeout: parseInt(process.env.SESSION_TIMEOUT || '1800000'), // 30 minutes
    idleWarning: 300000, // 5 minutes
    maxPerUser: parseInt(process.env.MAX_SESSIONS_PER_USER || '2'),
  },

  // Security
  security: {
    bcryptRounds: 10,
    maxLoginAttempts: 3,
    passwordMinLength: 6,
  },

  // Features
  features: {
    allowNewUsers: true,
    allowUploads: true,
    allowDownloads: true,
    allowDoors: true,
    requireEmailVerification: false,
  },

  // File transfer settings
  files: {
    ratioEnabled: process.env.FILE_RATIO_ENABLED === 'true' || false,
    downloadRatio: parseInt(process.env.FILE_DOWNLOAD_RATIO || '5'),   // 1 upload per N downloads
    exemptLevel: parseInt(process.env.FILE_EXEMPT_LEVEL || '90'),      // security level exempt from ratios
  },

  // ANSI Settings
  terminal: {
    width: 80,
    height: 24,
    encoding: 'utf8',
  },
};

export default config;
