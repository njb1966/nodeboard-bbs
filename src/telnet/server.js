/**
 * Telnet Server for BBS
 */
import net from 'net';
import config from '../config/index.js';
import { TelnetConnection } from './connection.js';
import { Session } from '../models/Session.js';
import { isBanned } from '../services/RateLimiter.js';

/** @type {TelnetServer|null} Singleton server instance for cross-module access */
let serverInstance = null;

/**
 * Get all active connections.
 * Safe to import from other modules — returns the live Map at call time,
 * avoiding circular-dependency issues at module-load time.
 * @returns {Map<string, TelnetConnection>}
 */
export function getConnections() {
  if (!serverInstance) return new Map();
  return serverInstance.connections;
}

/**
 * Find a connection by its assigned node number.
 * @param {number} nodeNum
 * @returns {TelnetConnection|undefined}
 */
export function getConnectionByNode(nodeNum) {
  if (!serverInstance) return undefined;
  for (const conn of serverInstance.connections.values()) {
    if (conn.nodeNumber === nodeNum) return conn;
  }
  return undefined;
}

/**
 * Register an external connection (e.g. SSH) with the shared connection pool.
 * Allocates a node number and adds the connection to the connections Map.
 * @param {string} connId - Unique connection identifier
 * @param {TelnetConnection} connection - The connection object
 * @returns {number} The assigned node number
 */
export function registerConnection(connId, connection) {
  if (!serverInstance) throw new Error('TelnetServer not initialised');
  if (serverInstance.connections.size >= serverInstance.config.maxConnections) {
    throw new Error('System at maximum capacity');
  }
  const nodeNum = serverInstance.allocateNode();
  connection.nodeNumber = nodeNum;
  serverInstance.connections.set(connId, connection);
  return nodeNum;
}

/**
 * Unregister a connection from the shared connection pool.
 * @param {string} connId - Unique connection identifier
 */
export function unregisterConnection(connId) {
  if (!serverInstance) return;
  const connection = serverInstance.connections.get(connId);
  if (connection) {
    serverInstance.releaseNode(connection.nodeNumber);
    serverInstance.connections.delete(connId);
  }
}

export class TelnetServer {
  constructor() {
    this.server = null;
    this.connections = new Map();
    this.config = config.bbs;

    // Node number allocation pool (1 .. maxConnections)
    this.availableNodes = new Set();
    for (let i = 1; i <= this.config.maxConnections; i++) {
      this.availableNodes.add(i);
    }

    // Register singleton so helper functions work
    serverInstance = this;
  }

  /**
   * Allocate the lowest available node number
   * @returns {number}
   */
  allocateNode() {
    const sorted = [...this.availableNodes].sort((a, b) => a - b);
    const node = sorted[0];
    this.availableNodes.delete(node);
    return node;
  }

  /**
   * Return a node number to the pool
   * @param {number} nodeNum
   */
  releaseNode(nodeNum) {
    if (nodeNum != null) {
      this.availableNodes.add(nodeNum);
    }
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

    // Check IP ban immediately before allocating resources
    if (isBanned(remoteAddress)) {
      console.log(`Banned IP rejected: ${remoteAddress}`);
      socket.write('Your IP has been banned.\r\n');
      socket.end();
      return;
    }

    // Check max connections
    if (this.connections.size >= this.config.maxConnections) {
      socket.write('System at maximum capacity. Please try again later.\r\n');
      socket.end();
      return;
    }

    // Create connection handler and assign node number
    const connection = new TelnetConnection(socket, remoteAddress);
    const nodeNum = this.allocateNode();
    connection.nodeNumber = nodeNum;
    this.connections.set(connId, connection);

    console.log(`Assigned node ${nodeNum} to ${connId}`);

    // Handle disconnection
    socket.on('close', () => {
      console.log(`Connection closed: ${connId} (node ${connection.nodeNumber})`);
      connection.cleanup();
      this.releaseNode(connection.nodeNumber);
      this.connections.delete(connId);
    });

    socket.on('error', (err) => {
      console.error(`Socket error for ${connId}:`, err.message);
      this.releaseNode(connection.nodeNumber);
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
        this.releaseNode(connection.nodeNumber);
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
