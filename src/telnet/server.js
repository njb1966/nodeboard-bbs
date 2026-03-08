/**
 * Telnet Server for BBS
 */
import net from 'net';
import config from '../config/index.js';
import { TelnetConnection } from './connection.js';
import { Session } from '../models/Session.js';

export class TelnetServer {
  constructor() {
    this.server = null;
    this.connections = new Map();
    this.config = config.bbs;
  }

  /**
   * Start the telnet server
   */
  start() {
    this.server = net.createServer((socket) => {
      this.handleConnection(socket);
    });

    this.server.on('error', (err) => {
      console.error('Telnet server error:', err);
    });

    this.server.listen(this.config.port, () => {
      console.log(`Telnet BBS server listening on port ${this.config.port}`);
      console.log(`Connect with: telnet localhost ${this.config.port}`);
    });

    // Cleanup inactive sessions periodically
    setInterval(() => {
      Session.cleanup();
    }, 60000); // Every minute
  }

  /**
   * Handle new connection
   */
  handleConnection(socket) {
    const remoteAddress = socket.remoteAddress;
    const remotePort = socket.remotePort;
    const connId = `${remoteAddress}:${remotePort}`;

    console.log(`New connection from ${connId}`);

    // Check max connections
    if (this.connections.size >= this.config.maxConnections) {
      socket.write('System at maximum capacity. Please try again later.\r\n');
      socket.end();
      return;
    }

    // Create connection handler
    const connection = new TelnetConnection(socket, remoteAddress);
    this.connections.set(connId, connection);

    // Handle disconnection
    socket.on('close', () => {
      console.log(`Connection closed: ${connId}`);
      connection.cleanup();
      this.connections.delete(connId);
    });

    socket.on('error', (err) => {
      console.error(`Socket error for ${connId}:`, err.message);
      this.connections.delete(connId);
    });

    // Start the connection
    connection.start();
  }

  /**
   * Stop the server
   */
  stop() {
    if (this.server) {
      // Close all connections
      for (const connection of this.connections.values()) {
        connection.cleanup();
      }
      this.connections.clear();

      this.server.close(() => {
        console.log('Telnet server stopped');
      });
    }
  }

  /**
   * Get active connection count
   */
  getConnectionCount() {
    return this.connections.size;
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message) {
    for (const connection of this.connections.values()) {
      if (connection.isAuthenticated()) {
        connection.write(message);
      }
    }
  }
}

export default TelnetServer;
