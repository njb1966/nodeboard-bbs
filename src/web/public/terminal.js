/**
 * Web Terminal Frontend - xterm.js based BBS terminal
 */
import { Terminal } from '/xterm/lib/xterm.mjs';
import { FitAddon } from '/xterm-addon-fit/lib/addon-fit.mjs';
import { WebLinksAddon } from '/xterm-addon-web-links/lib/addon-web-links.mjs';

// Create terminal instance
const term = new Terminal({
  cols: 80,
  rows: 24,
  cursorBlink: true,
  cursorStyle: 'block',
  fontFamily: "'Courier New', Courier, monospace",
  fontSize: 16,
  theme: {
    background: '#000000',
    foreground: '#00ff00',
    cursor: '#00ff00',
    cursorAccent: '#000000',
    selectionBackground: '#00ffff44',
    black: '#000000',
    red: '#aa0000',
    green: '#00aa00',
    yellow: '#aa5500',
    blue: '#0000aa',
    magenta: '#aa00aa',
    cyan: '#00aaaa',
    white: '#aaaaaa',
    brightBlack: '#555555',
    brightRed: '#ff5555',
    brightGreen: '#55ff55',
    brightYellow: '#ffff55',
    brightBlue: '#5555ff',
    brightMagenta: '#ff55ff',
    brightCyan: '#55ffff',
    brightWhite: '#ffffff',
  },
  allowProposedApi: true,
  scrollback: 1000,
});

// Load addons
const fitAddon = new FitAddon();
const webLinksAddon = new WebLinksAddon();
term.loadAddon(fitAddon);
term.loadAddon(webLinksAddon);

// Open terminal in container
const container = document.getElementById('terminal-container');
term.open(container);
fitAddon.fit();

// Connect via WebSocket
const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const wsUrl = `${protocol}//${window.location.host}/ws/terminal`;
let ws = null;

function connect() {
  ws = new WebSocket(wsUrl);
  ws.binaryType = 'arraybuffer';

  ws.onopen = () => {
    console.log('WebSocket connected to BBS');
    // Send initial terminal size
    ws.send(JSON.stringify({
      type: 'resize',
      cols: term.cols,
      rows: term.rows,
    }));
  };

  ws.onmessage = (event) => {
    if (event.data instanceof ArrayBuffer) {
      // Binary data - write directly to terminal
      term.write(new Uint8Array(event.data));
    } else {
      // Text data - write directly to terminal
      term.write(event.data);
    }
  };

  ws.onclose = () => {
    console.log('WebSocket disconnected');
    const overlay = document.getElementById('overlay');
    overlay.classList.add('visible');
  };

  ws.onerror = (error) => {
    console.error('WebSocket error:', error);
  };
}

// Send user input to WebSocket
term.onData((data) => {
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(data);
  }
});

// Handle terminal resize
window.addEventListener('resize', () => {
  fitAddon.fit();
  if (ws && ws.readyState === WebSocket.OPEN) {
    ws.send(JSON.stringify({
      type: 'resize',
      cols: term.cols,
      rows: term.rows,
    }));
  }
});

// Focus terminal on click
container.addEventListener('click', () => {
  term.focus();
});

// Start connection
connect();

// Auto-focus
term.focus();
