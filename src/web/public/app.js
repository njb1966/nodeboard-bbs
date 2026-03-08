/**
 * Web Client JavaScript
 */

// Global state
let ws = null;
let isConnected = false;

// Fetch BBS stats
async function loadStats() {
  try {
    const response = await fetch('/api/stats');
    const stats = await response.json();

    // Update telnet address
    document.getElementById('telnet-host').textContent = window.location.hostname || 'localhost';
    document.getElementById('telnet-port').textContent = stats.telnetPort;

    // Update sysop name
    const sysopElement = document.getElementById('sysop-name');
    if (sysopElement) {
      sysopElement.textContent = stats.sysop || 'Sysop';
    }

    // Update page title
    document.title = stats.bbsName;
  } catch (error) {
    console.error('Failed to load stats:', error);
  }
}

// Tab switching functionality
function switchTab(tabName) {
  // Hide all tab contents
  const tabContents = document.querySelectorAll('.tab-content');
  tabContents.forEach(content => {
    content.classList.remove('active');
  });

  // Remove active class from all buttons
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.classList.remove('active');
  });

  // Show selected tab content
  const selectedTab = document.getElementById(`${tabName}-tab`);
  if (selectedTab) {
    selectedTab.classList.add('active');
  }

  // Activate selected button
  const selectedButton = document.querySelector(`[data-tab="${tabName}"]`);
  if (selectedButton) {
    selectedButton.classList.add('active');
  }
}

// Initialize tab navigation
function initTabs() {
  const tabButtons = document.querySelectorAll('.tab-button');
  tabButtons.forEach(button => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');
      switchTab(tabName);
    });
  });
}

// Initialize WebSocket terminal connection
function initWebSocketTerminal() {
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const clearBtn = document.getElementById('clear-btn');
  const statusElement = document.getElementById('connection-status');
  const iframe = document.getElementById('telnet-frame');

  if (connectBtn) {
    connectBtn.addEventListener('click', () => {
      connectToTerminal();
    });
  }

  if (disconnectBtn) {
    disconnectBtn.addEventListener('click', () => {
      disconnectFromTerminal();
    });
  }

  if (clearBtn) {
    clearBtn.addEventListener('click', () => {
      // Reload iframe to clear content
      if (iframe) {
        iframe.src = 'about:blank';
      }
    });
  }
}

// Connect to terminal via WebSocket
function connectToTerminal() {
  const connectBtn = document.getElementById('connect-btn');
  const disconnectBtn = document.getElementById('disconnect-btn');
  const statusElement = document.getElementById('connection-status');
  const iframe = document.getElementById('telnet-frame');

  if (isConnected) {
    updateStatus('Already connected', 'green');
    return;
  }

  try {
    updateStatus('Connecting...', 'yellow');
    connectBtn.disabled = true;

    // Create WebSocket connection
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    ws = new WebSocket(`${protocol}//${window.location.host}`);

    ws.onopen = () => {
      isConnected = true;
      updateStatus('Connected', 'green');
      connectBtn.disabled = true;
      disconnectBtn.disabled = false;

      // Load terminal interface (using xterm.js or similar in production)
      loadTerminalInterface();
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data);
      console.log('Received:', data);
      handleTerminalData(data);
    };

    ws.onclose = () => {
      isConnected = false;
      updateStatus('Disconnected', 'red');
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      updateStatus('Connection Error', 'red');
      connectBtn.disabled = false;
      disconnectBtn.disabled = true;
    };

  } catch (error) {
    console.error('Failed to connect:', error);
    updateStatus('Connection Failed', 'red');
    connectBtn.disabled = false;
  }
}

// Disconnect from terminal
function disconnectFromTerminal() {
  if (ws && isConnected) {
    ws.close();
    isConnected = false;

    const connectBtn = document.getElementById('connect-btn');
    const disconnectBtn = document.getElementById('disconnect-btn');
    const iframe = document.getElementById('telnet-frame');

    connectBtn.disabled = false;
    disconnectBtn.disabled = true;

    if (iframe) {
      iframe.src = 'about:blank';
    }

    updateStatus('Disconnected', 'yellow');
  }
}

// Update connection status display
function updateStatus(message, color) {
  const statusElement = document.getElementById('connection-status');
  if (statusElement) {
    statusElement.textContent = message;
    statusElement.className = `text-${color}`;
  }
}

// Load terminal interface
function loadTerminalInterface() {
  const iframe = document.getElementById('telnet-frame');
  if (!iframe) return;

  // Create a simple terminal interface within iframe
  const doc = iframe.contentDocument || iframe.contentWindow.document;
  doc.open();
  doc.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <style>
        body {
          background: #000;
          color: #00ff00;
          font-family: 'Courier New', Courier, monospace;
          margin: 0;
          padding: 20px;
          overflow: auto;
        }
        #terminal-output {
          white-space: pre-wrap;
          word-wrap: break-word;
        }
        #terminal-input {
          background: #000;
          color: #00ff00;
          border: 1px solid #00ff00;
          font-family: 'Courier New', Courier, monospace;
          font-size: 14px;
          padding: 5px;
          width: calc(100% - 12px);
          margin-top: 10px;
        }
        .cursor {
          display: inline-block;
          width: 10px;
          height: 16px;
          background: #00ff00;
          animation: blink 1s infinite;
        }
        @keyframes blink {
          0%, 50% { opacity: 1; }
          51%, 100% { opacity: 0; }
        }
      </style>
    </head>
    <body>
      <div id="terminal-output">
        <span style="color: #00ffff;">╔════════════════════════════════════════════════════════════════╗</span><br>
        <span style="color: #00ffff;">║</span> <span style="color: #ffff00;">NodeBoard BBS - Web Terminal</span>                                  <span style="color: #00ffff;">║</span><br>
        <span style="color: #00ffff;">╚════════════════════════════════════════════════════════════════╝</span><br>
        <br>
        <span style="color: #00ff00;">Connected to BBS server via WebSocket</span><br>
        <span style="color: #ffff00;">Note: This is a basic terminal interface.</span><br>
        <span style="color: #ffff00;">For full ANSI graphics, use a telnet client like SyncTERM.</span><br>
        <br>
        <span style="color: #00ffff;">Ready to connect...</span><br>
        <span class="cursor"></span>
      </div>
      <input type="text" id="terminal-input" placeholder="Type commands here..." autofocus>
      <script>
        const input = document.getElementById('terminal-input');
        const output = document.getElementById('terminal-output');

        input.addEventListener('keypress', (e) => {
          if (e.key === 'Enter') {
            const command = input.value;
            if (command) {
              output.innerHTML += '<br><span style="color: #00ff00;">$ ' + command + '</span>';
              // Send to parent via postMessage
              window.parent.postMessage({ type: 'terminal-command', data: command }, '*');
              input.value = '';
              output.scrollTop = output.scrollHeight;
            }
          }
        });

        // Receive messages from parent
        window.addEventListener('message', (e) => {
          if (e.data && e.data.type === 'terminal-output') {
            output.innerHTML += '<br>' + e.data.data;
            output.scrollTop = output.scrollHeight;
          }
        });
      </script>
    </body>
    </html>
  `);
  doc.close();
}

// Handle terminal data from WebSocket
function handleTerminalData(data) {
  const iframe = document.getElementById('telnet-frame');
  if (!iframe) return;

  // Send data to iframe terminal
  iframe.contentWindow.postMessage({
    type: 'terminal-output',
    data: data.message || JSON.stringify(data)
  }, '*');
}

// Listen for messages from terminal iframe
window.addEventListener('message', (e) => {
  if (e.data && e.data.type === 'terminal-command') {
    // Send command to WebSocket
    if (ws && isConnected) {
      ws.send(JSON.stringify({
        type: 'command',
        data: e.data.data
      }));
    }
  }
});

// Expose switchTab globally for onclick handlers
window.switchTab = switchTab;

// Load stats and initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  loadStats();
  initTabs();
  initWebSocketTerminal();
});
