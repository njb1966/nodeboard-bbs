/**
 * Web Server for BBS
 */
import express from 'express';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';
import config from '../config/index.js';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class WebServer {
  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    this.wss = new WebSocketServer({ server: this.server });

    this.setupRoutes();
    this.setupWebSocket();
  }

  /**
   * Setup Express routes
   */
  setupRoutes() {
    // Middleware
    this.app.use(express.json());
    this.app.use(express.static(join(__dirname, 'public')));

    // Main page
    this.app.get('/', (req, res) => {
      res.sendFile(join(__dirname, 'public', 'index.html'));
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
  }

  /**
   * Setup WebSocket for terminal emulation
   */
  setupWebSocket() {
    this.wss.on('connection', (ws) => {
      console.log('WebSocket client connected');

      ws.on('message', (message) => {
        // Handle WebSocket messages (for future terminal emulation)
        console.log('Received:', message.toString());
      });

      ws.on('close', () => {
        console.log('WebSocket client disconnected');
      });

      // Send welcome message
      ws.send(JSON.stringify({
        type: 'welcome',
        message: `Welcome to ${config.bbs.name}!`,
      }));
    });
  }

  /**
   * Start the web server
   */
  start() {
    this.server.listen(config.web.port, () => {
      console.log(`Web server listening on port ${config.web.port}`);
      console.log(`Access at: http://localhost:${config.web.port}`);
    });
  }

  /**
   * Stop the web server
   */
  stop() {
    this.server.close(() => {
      console.log('Web server stopped');
    });
  }
}

export default WebServer;
