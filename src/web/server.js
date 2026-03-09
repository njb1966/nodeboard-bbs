/**
 * Web Server for BBS
 */
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import { createReadStream, existsSync } from 'fs';
import { EventEmitter } from 'events';
import config from '../config/index.js';
import { TelnetConnection } from '../telnet/connection.js';
import { getConnections } from '../telnet/server.js';
import { redeemDownloadToken } from '../services/DownloadTokenService.js';
import { receiveMessage, processSyncQueue } from '../services/NetworkService.js';
import getDatabase from '../database/db.js';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '../..');

/**
 * WebSocketBridge - Mimics a net.Socket for TelnetConnection
 *
 * TelnetConnection expects a socket with:
 *   - write(data) to send output
 *   - on('data', cb) to receive input
 *   - on('close', cb) to handle disconnect
 *   - on('error', cb) to handle errors
 *   - end() to close the connection
 *   - remoteAddress property
 *
 * This bridge translates between WebSocket messages and that interface.
 */
class WebSocketBridge extends EventEmitter {
  constructor(ws, remoteAddress) {
    super();
    this.ws = ws;
    this.remoteAddress = remoteAddress;
    this.remotePort = 0;
    this.destroyed = false;

    // WebSocket message -> 'data' event
    ws.on('message', (message) => {
      if (this.destroyed) return;

      // Check if this is a JSON control message (resize, etc.)
      if (typeof message === 'string' || (message instanceof Buffer && message[0] === 0x7b)) {
        try {
          const str = message.toString();
          const parsed = JSON.parse(str);
          if (parsed.type === 'resize') {
            // Emit resize event for future use
            this.emit('resize', { cols: parsed.cols, rows: parsed.rows });
            return;
          }
        } catch {
          // Not JSON - treat as terminal input
        }
      }

      // Convert to Buffer for TelnetConnection.handleData()
      const buf = Buffer.isBuffer(message)
        ? message
        : Buffer.from(message.toString(), 'utf8');
      this.emit('data', buf);
    });

    // WebSocket close -> 'close' event
    ws.on('close', () => {
      this.destroyed = true;
      this.emit('close');
    });

    // WebSocket error -> 'error' event
    ws.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /**
   * Write data to the WebSocket client.
   * TelnetConnection.write() and BBSScreen.write() call this.
   */
  write(data) {
    if (this.destroyed) return false;
    if (this.ws.readyState !== 1 /* OPEN */) return false;

    try {
      if (Buffer.isBuffer(data)) {
        this.ws.send(data);
      } else {
        this.ws.send(String(data));
      }
      return true;
    } catch {
      return false;
    }
  }

  /**
   * End the connection
   */
  end() {
    this.destroyed = true;
    try {
      this.ws.close();
    } catch {
      // Already closed
    }
  }

  /**
   * Destroy the connection
   */
  destroy() {
    this.end();
  }
}

/**
 * WebTelnetConnection - Extends TelnetConnection for web clients
 *
 * Overrides setupTelnet() to skip telnet negotiation (xterm.js doesn't
 * speak the telnet protocol) while preserving the full BBS experience:
 * login, menus, forums, chat, door games, etc.
 */
class WebTelnetConnection extends TelnetConnection {
  constructor(socket, remoteAddress) {
    super(socket, remoteAddress);
    this.protocol = 'web';
  }

  /**
   * Skip telnet IAC negotiation - xterm.js handles terminal emulation natively
   */
  setupTelnet() {
    // No-op for web connections: xterm.js is a full terminal emulator
    // and does not understand telnet IAC sequences
  }

  /**
   * Override filterTelnetCommands to pass data through unchanged.
   * Web clients send clean UTF-8; there are no IAC bytes to strip.
   */
  filterTelnetCommands(data) {
    return Buffer.isBuffer(data) ? data : Buffer.from(data);
  }
}

export class WebServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);

    // Main informational WebSocket (existing functionality)
    this.wss = new WebSocketServer({ noServer: true });

    // Terminal WebSocket (new: xterm.js bridge)
    this.wssTerminal = new WebSocketServer({ noServer: true });

    // Handle HTTP upgrade to route to the correct WSS
    this.server.on('upgrade', (request, socket, head) => {
      const url = new URL(request.url, `http://${request.headers.host}`);

      if (url.pathname === '/ws/terminal') {
        this.wssTerminal.handleUpgrade(request, socket, head, (ws) => {
          this.wssTerminal.emit('connection', ws, request);
        });
      } else if (url.pathname === '/ws') {
        this.wss.handleUpgrade(request, socket, head, (ws) => {
          this.wss.emit('connection', ws, request);
        });
      } else {
        socket.destroy();
      }
    });

    this.setupRoutes();
    this.setupWebSocket();
    this.setupTerminalWebSocket();
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Middleware
    this.app.use(express.json());

    // Serve xterm.js assets from node_modules
    this.app.use('/xterm', express.static(join(projectRoot, 'node_modules/@xterm/xterm')));
    this.app.use('/xterm-addon-fit', express.static(join(projectRoot, 'node_modules/@xterm/addon-fit')));
    this.app.use('/xterm-addon-web-links', express.static(join(projectRoot, 'node_modules/@xterm/addon-web-links')));

    // Static files for the web interface
    this.app.use(express.static(join(__dirname, 'public')));

    // Main page
    this.app.get('/', (req, res) => {
      res.sendFile(join(__dirname, 'public', 'index.html'));
    });

    // Terminal page
    this.app.get('/terminal', (req, res) => {
      res.sendFile(join(__dirname, 'public', 'terminal.html'));
    });

    // File download endpoint (token-based, single-use, time-limited)
    this.app.get('/download/:token', (req, res) => {
      const tokenData = redeemDownloadToken(req.params.token);

      if (!tokenData) {
        return res.status(404).send('Download link has expired or is invalid.');
      }

      if (!existsSync(tokenData.filePath)) {
        return res.status(404).send('File not found on server.');
      }

      res.setHeader('Content-Disposition', `attachment; filename="${basename(tokenData.fileName)}"`);
      res.setHeader('Content-Type', 'application/octet-stream');

      const stream = createReadStream(tokenData.filePath);
      stream.pipe(res);
      stream.on('error', () => {
        if (!res.headersSent) {
          res.status(500).send('Error reading file.');
        }
      });
    });

    // API endpoints (basic)
    this.app.get('/api/stats', (req, res) => {
      res.json({
        bbsName: config.bbs.name,
        version: config.bbs.version,
        telnetPort: config.bbs.port,
        sysop: config.bbs.sysop,
      });
    });

    // ─── Inter-BBS Sync Endpoints ──────────────────────────────────────────

    // Receive messages from linked BBSes
    this.app.post('/api/sync/receive', (req, res) => {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        return res.status(401).json({ error: 'Missing X-API-Key header' });
      }

      const result = receiveMessage(apiKey, req.body);
      if (result.success) {
        res.json({ success: true, message: result.message || 'Message received' });
      } else {
        res.status(400).json({ success: false, error: result.error });
      }
    });

    // Push pending messages (trigger sync processing)
    this.app.post('/api/sync/push', async (req, res) => {
      const apiKey = req.headers['x-api-key'];
      if (!apiKey) {
        return res.status(401).json({ error: 'Missing X-API-Key header' });
      }

      // Simple API key validation — any valid linked BBS key works
      const db = getDatabase();
      const link = db.prepare(
        'SELECT id FROM bbs_links WHERE api_key = ? AND enabled = 1'
      ).get(apiKey);

      if (!link) {
        return res.status(401).json({ error: 'Invalid API key' });
      }

      try {
        const result = await processSyncQueue();
        res.json({ success: true, message: result });
      } catch (err) {
        res.status(500).json({ success: false, error: err.message });
      }
    });
  }

  /**
   * Setup WebSocket for informational / status updates (existing)
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected (info)');

      ws.on('message', (message) => {
        console.log('Received:', message.toString());
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected (info)');
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: `Welcome to ${config.bbs.name}!`,
      }));
    });
  }

  /**
   * Setup WebSocket for terminal connections (xterm.js bridge)
   *
   * Each connection creates a WebSocketBridge that looks like a net.Socket,
   * wraps it in a WebTelnetConnection (which skips telnet negotiation),
   * and registers it with the telnet server's connection map and node pool.
   */
  setupTerminalWebSocket() {
    this.wssTerminal.on('connection', (ws, request) => {
      // Determine remote address from headers (proxy support) or socket
      const forwarded = request.headers['x-forwarded-for'];
      const remoteAddress = forwarded
        ? forwarded.split(',')[0].trim()
        : request.socket.remoteAddress;

      console.log(`Web terminal connection from ${remoteAddress}`);

      // Create the bridge and connection
      const bridge = new WebSocketBridge(ws, remoteAddress);
      const connection = new WebTelnetConnection(bridge, remoteAddress);
      const connId = `web:${remoteAddress}:${Date.now()}`;

      // Register with telnet server's shared connection map and allocate a node
      this._registerConnection(connection, connId);

      // Handle disconnect
      bridge.on('close', () => {
        console.log(`Web terminal disconnected: ${connId} (node ${connection.nodeNumber})`);
        connection.cleanup();
        this._unregisterConnection(connection, connId);
      });

      bridge.on('error', (err) => {
        console.error(`Web terminal error for ${connId}:`, err.message);
        this._unregisterConnection(connection, connId);
      });

      // Start the BBS session (welcome screen, login, etc.)
      connection.start();
    });
  }

  /**
   * Register a web terminal connection with the telnet server's tracking
   */
  _registerConnection(connection, connId) {
    // Get the telnet server's connection map
    const connections = getConnections();

    // Check capacity
    if (connections.size >= config.bbs.maxConnections) {
      connection.write('System at maximum capacity. Please try again later.\r\n');
      connection.socket.end();
      return;
    }

    // Allocate the lowest available node number by scanning active connections
    const usedNodes = new Set();
    for (const conn of connections.values()) {
      if (conn.nodeNumber != null) usedNodes.add(conn.nodeNumber);
    }
    let nodeNum = null;
    for (let i = 1; i <= config.bbs.maxConnections; i++) {
      if (!usedNodes.has(i)) {
        nodeNum = i;
        break;
      }
    }

    connection.nodeNumber = nodeNum;
    connections.set(connId, connection);
    console.log(`Web terminal assigned node ${nodeNum} to ${connId}`);
  }

  /**
   * Unregister a web terminal connection
   */
  _unregisterConnection(connection, connId) {
    const connections = getConnections();
    connections.delete(connId);
    // Node number returns to the pool naturally since we scan for used nodes
  }

  /**
   * Start the web server
   */
  start() {
    this.server.listen(config.web.port, () => {
      console.log(`Web server listening on port ${config.web.port}`);
      console.log(`Access at: http://localhost:${config.web.port}`);
      console.log(`Web terminal at: http://localhost:${config.web.port}/terminal`);
    });
  }

  /**
   * Stop the web server
   */
  stop() {
    // Close all terminal WebSocket connections
    this.wssTerminal.clients.forEach((ws) => {
      ws.close();
    });

    this.server.close(() => {
      console.log('Web server stopped');
    });
  }
}

export default WebServer;
