/**
 * SSH Server for BBS
 *
 * Provides SSH access alongside the existing Telnet server.
 * Authenticated users are handed off to the shared TelnetConnection handler
 * with protocol='ssh', skipping telnet negotiation and the login flow.
 */
import ssh2 from 'ssh2';
const { Server } = ssh2;
import { readFileSync } from 'fs';
import config from '../config/index.js';
import { User } from '../models/User.js';
import { Session } from '../models/Session.js';
import { TelnetConnection } from '../telnet/connection.js';
import { registerConnection, unregisterConnection } from '../telnet/server.js';
import { isBanned, isLocked, recordFailedLogin, recordSuccessfulLogin } from '../services/RateLimiter.js';

export class SSHServer {
  constructor() {
    this.server = null;
  }

  /**
   * Start the SSH server.
   * @param {string} hostKeyPath - Absolute path to the PEM host key file.
   */
  start(hostKeyPath) {
    const hostKey = readFileSync(hostKeyPath);

    this.server = new Server({ hostKeys: [hostKey] }, (client, info) => {
      this.handleClient(client, info);
    });

    this.server.on('error', (err) => {
      console.error('SSH server error:', err);
    });

    this.server.listen(config.ssh.port, () => {
      console.log(`SSH BBS server listening on port ${config.ssh.port}`);
      console.log(`Connect with: ssh -p ${config.ssh.port} <username>@localhost`);
    });
  }

  /**
   * Handle a new SSH client connection.
   */
  handleClient(client, info) {
    const remoteAddress = info?.ip || info?.address || 'unknown';
    let authenticatedUser = null;

    // Reject banned or locked-out IPs immediately
    if (isBanned(remoteAddress) || isLocked(remoteAddress)) {
      console.log(`SSH: Rejected banned/locked IP ${remoteAddress}`);
      client.end();
      return;
    }

    client.on('authentication', async (ctx) => {
      if (ctx.method === 'password') {
        try {
          const user = User.findByUsername(ctx.username);
          if (user && await user.verifyPassword(ctx.password)) {
            // Check max sessions per user
            const activeSessions = Session.getActiveByUserId(user.id);
            if (activeSessions >= config.session.maxPerUser) {
              ctx.reject(['password']);
              return;
            }

            recordSuccessfulLogin(remoteAddress);
            authenticatedUser = user;
            ctx.accept();
          } else {
            recordFailedLogin(remoteAddress);
            ctx.reject(['password']);
          }
        } catch (err) {
          console.error('SSH auth error:', err);
          ctx.reject(['password']);
        }
      } else {
        // Only password auth is supported
        ctx.reject(['password']);
      }
    });

    client.on('ready', () => {
      console.log(`SSH client authenticated: ${authenticatedUser.username} from ${remoteAddress}`);

      client.on('session', (accept) => {
        const session = accept();

        session.on('pty', (accept) => {
          accept();
        });

        session.on('shell', (accept) => {
          const channel = accept();
          this.setupConnection(channel, remoteAddress, authenticatedUser, client);
        });
      });
    });

    client.on('error', (err) => {
      // Connection reset / client disconnect — not a real error
      if (err.code === 'ECONNRESET' || err.level === 'client-timeout') return;
      console.error('SSH client error:', err.message);
    });
  }

  /**
   * Wire an SSH channel into the shared BBS connection handler.
   */
  setupConnection(channel, remoteAddress, user, client) {
    const connId = `ssh:${remoteAddress}:${user.username}:${Date.now()}`;

    const connection = new TelnetConnection(channel, remoteAddress, {
      protocol: 'ssh',
      user,
    });

    // Register with the shared connection pool
    let nodeNum;
    try {
      nodeNum = registerConnection(connId, connection);
    } catch (err) {
      channel.write('System at maximum capacity. Please try again later.\r\n');
      channel.close();
      client.end();
      return;
    }

    console.log(`SSH: Assigned node ${nodeNum} to ${connId}`);

    // Handle channel close
    channel.on('close', () => {
      console.log(`SSH connection closed: ${connId} (node ${connection.nodeNumber})`);
      connection.cleanup();
      unregisterConnection(connId);
    });

    channel.on('error', (err) => {
      console.error(`SSH channel error for ${connId}:`, err.message);
      connection.cleanup();
      unregisterConnection(connId);
    });

    // Also handle the overall client disconnect
    client.on('end', () => {
      // Channel close handler above will fire; nothing extra needed
    });

    // Start the BBS session (will skip login since user is pre-set)
    connection.start();
  }

  /**
   * Stop the SSH server.
   */
  stop() {
    if (this.server) {
      this.server.close(() => {
        console.log('SSH server stopped');
      });
    }
  }
}

export default SSHServer;
