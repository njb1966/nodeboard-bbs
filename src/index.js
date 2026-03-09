/**
 * NodeBoard BBS - Main Entry Point
 */
import { TelnetServer } from './telnet/server.js';
import { WebServer } from './web/server.js';
import { SSHServer } from './ssh/server.js';
import config from './config/index.js';
import { existsSync, writeFileSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import crypto from 'crypto';
import { colorText } from './utils/ansi.js';

console.log(colorText('='.repeat(60), 'cyan', null, true));
console.log(colorText('  NodeBoard BBS System', 'yellow', null, true));
console.log(colorText(`  Version ${config.bbs.version}`, 'white'));
console.log(colorText('='.repeat(60), 'cyan', null, true));
console.log();

// Check if database exists
if (!existsSync(config.database.path)) {
  console.error(colorText('ERROR: Database not found!', 'red', null, true));
  console.log(colorText('Please run: npm run init-db', 'yellow', null, true));
  console.log();
  process.exit(1);
}

// Start Telnet Server
console.log(colorText('Starting Telnet Server...', 'green', null, true));
const telnetServer = new TelnetServer();
telnetServer.start();

// Start SSH Server (if enabled)
let sshServer = null;
if (config.ssh.enabled) {
  try {
    // Ensure host key exists, generate if not
    const keyPath = config.ssh.hostKeyPath;
    if (!existsSync(keyPath)) {
      console.log(colorText('Generating SSH host key...', 'yellow'));
      mkdirSync(dirname(keyPath), { recursive: true });
      const { privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        privateKeyEncoding: { type: 'pkcs1', format: 'pem' },
        publicKeyEncoding: { type: 'pkcs1', format: 'pem' },
      });
      writeFileSync(keyPath, privateKey, { mode: 0o600 });
      console.log(colorText(`SSH host key generated at ${keyPath}`, 'green'));
    }

    console.log(colorText('Starting SSH Server...', 'green', null, true));
    sshServer = new SSHServer();
    sshServer.start(keyPath);
  } catch (err) {
    console.error(colorText(`Failed to start SSH server: ${err.message}`, 'red', null, true));
    console.log(colorText('SSH access will be unavailable this session.', 'yellow'));
  }
}

// Start Web Server (if enabled)
if (config.web.enabled) {
  console.log(colorText('Starting Web Server...', 'green', null, true));
  const webServer = new WebServer();
  webServer.start();
}

console.log();
console.log(colorText('='.repeat(60), 'cyan', null, true));
console.log(colorText('  BBS is now running!', 'green', null, true));
console.log(colorText('='.repeat(60), 'cyan', null, true));
console.log();
console.log(colorText(`  Telnet Access: `, 'white', null, true) + colorText(`telnet localhost ${config.bbs.port}`, 'cyan'));
if (config.ssh.enabled && sshServer) {
  console.log(colorText(`  SSH Access:    `, 'white', null, true) + colorText(`ssh -p ${config.ssh.port} <user>@localhost`, 'cyan'));
}
if (config.web.enabled) {
  console.log(colorText(`  Web Access:    `, 'white', null, true) + colorText(`http://localhost:${config.web.port}`, 'cyan'));
}
console.log();
console.log(colorText('  Press Ctrl+C to stop the server', 'yellow'));
console.log();

// Handle shutdown
process.on('SIGINT', () => {
  console.log();
  console.log(colorText('Shutting down BBS...', 'yellow', null, true));

  telnetServer.stop();
  if (sshServer) sshServer.stop();

  console.log(colorText('Goodbye!', 'green', null, true));
  process.exit(0);
});

// Handle uncaught errors
process.on('uncaughtException', (error) => {
  console.error(colorText('Uncaught Exception:', 'red', null, true), error);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error(colorText('Unhandled Rejection at:', 'red', null, true), promise, 'reason:', reason);
});
