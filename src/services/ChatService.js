/**
 * Chat Service — Node-to-node paging, real-time chat, and multi-user chat rooms
 *
 * Provides:
 * - Private paging between two users (original functionality)
 * - Multi-user chat rooms via ChatRoomManager
 */
import { colorText } from '../utils/ansi.js';
import { BOX } from '../utils/ansi.js';
import { getConnections, getConnectionByNode } from '../telnet/server.js';
import {
  getRooms, getRoom, createRoom,
  joinRoom as roomJoin, leaveRoom as roomLeave,
  broadcastToRoom, getUserRooms, removeFromAllRooms,
} from './ChatRoomManager.js';

/** Page request timeout in milliseconds */
const PAGE_TIMEOUT_MS = 30000;

export class ChatService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Main entry point — show the chat & communication menu.
   */
  async show() {
    let running = true;

    while (running) {
      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('  Chat & Communication', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(57), 'cyan', null, true) + '\r\n\r\n');

      this.connection.write(colorText('  [P]', 'green', null, true) + colorText(' Page a User (Private Chat)', 'white') + '\r\n');
      this.connection.write(colorText('  [J]', 'green', null, true) + colorText(' Join a Chat Room', 'white') + '\r\n');
      this.connection.write(colorText('  [L]', 'green', null, true) + colorText(' List Chat Rooms', 'white') + '\r\n');
      this.connection.write(colorText('  [C]', 'green', null, true) + colorText(' Create a Chat Room', 'white') + '\r\n');
      this.connection.write(colorText('  [Q]', 'green', null, true) + colorText(' Quit', 'white') + '\r\n');

      this.connection.write('\r\n');
      this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(57), 'cyan') + '\r\n');

      const choice = await this.connection.getInput('  Your choice: ');

      switch ((choice || '').toUpperCase()) {
        case 'P':
          await this.page();
          break;
        case 'J':
          await this.joinRoomPrompt();
          break;
        case 'L':
          await this.listRooms();
          break;
        case 'C':
          await this.createRoomPrompt();
          break;
        case 'Q':
        case '':
          running = false;
          break;
        default:
          break;
      }
    }
  }

  // ─────────────────────────────────────────────────────────────
  //  Chat Room methods
  // ─────────────────────────────────────────────────────────────

  /**
   * List all chat rooms with member counts.
   */
  async listRooms() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  Chat Rooms', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(57), 'cyan', null, true) + '\r\n\r\n');

    this.connection.write(
      colorText('  #  ', 'white', null, true) +
      colorText('Room Name       ', 'white', null, true) +
      colorText('Users  ', 'white', null, true) +
      colorText('Topic', 'white', null, true) + '\r\n'
    );
    this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(57), 'cyan') + '\r\n');

    const allRooms = getRooms();
    let idx = 0;

    for (const room of allRooms.values()) {
      idx++;
      const num = idx.toString().padStart(2);
      const name = room.name.padEnd(16);
      const users = room.members.size.toString().padEnd(7);
      const topic = (room.topic || '').substring(0, 25);

      this.connection.write(
        colorText('  ' + num + ' ', 'green', null, true) +
        colorText(name, 'cyan') +
        colorText(users, 'white', null, true) +
        colorText(topic, 'white') + '\r\n'
      );
    }

    if (idx === 0) {
      this.connection.write(colorText('  No rooms available.', 'white') + '\r\n');
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('  Press any key to continue...', 'white') + '\r\n');
    await this.connection.getChar();
  }

  /**
   * Prompt user to join a chat room (by name or number from the list).
   */
  async joinRoomPrompt() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  Join a Chat Room', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(57), 'cyan', null, true) + '\r\n\r\n');

    // Show available rooms
    const allRooms = getRooms();
    const roomList = [...allRooms.values()];

    if (roomList.length > 0) {
      this.connection.write(
        colorText('  #  ', 'white', null, true) +
        colorText('Room Name       ', 'white', null, true) +
        colorText('Users  ', 'white', null, true) +
        colorText('Topic', 'white', null, true) + '\r\n'
      );
      this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(57), 'cyan') + '\r\n');

      roomList.forEach((room, i) => {
        const num = (i + 1).toString().padStart(2);
        const name = room.name.padEnd(16);
        const users = room.members.size.toString().padEnd(7);
        const topic = (room.topic || '').substring(0, 25);

        this.connection.write(
          colorText('  ' + num + ' ', 'green', null, true) +
          colorText(name, 'cyan') +
          colorText(users, 'white', null, true) +
          colorText(topic, 'white') + '\r\n'
        );
      });

      this.connection.write('\r\n');
    }

    const input = await this.connection.getInput('  Enter room number or name (or ENTER to cancel): ');
    if (!input) return;

    let roomName;

    // Check if it's a number (selecting from the list)
    const num = parseInt(input, 10);
    if (!isNaN(num) && num >= 1 && num <= roomList.length) {
      roomName = roomList[num - 1].name;
    } else {
      // Treat as room name — normalize
      roomName = input.startsWith('#') ? input.toLowerCase() : '#' + input.toLowerCase();
    }

    // Auto-create if doesn't exist
    let room = getRoom(roomName);
    if (!room) {
      room = createRoom(roomName);
      this.connection.write(colorText(`\r\n  Room ${room.name} created.\r\n`, 'green', null, true));
    }

    await this.enterChatRoom(room.name);
  }

  /**
   * Prompt to create a new chat room.
   */
  async createRoomPrompt() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  Create a Chat Room', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(57), 'cyan', null, true) + '\r\n\r\n');

    const name = await this.connection.getInput('  Room name (e.g. #gaming): ');
    if (!name) return;

    const normalized = name.startsWith('#') ? name.toLowerCase() : '#' + name.toLowerCase();

    if (getRoom(normalized)) {
      this.connection.write(colorText(`\r\n  Room ${normalized} already exists.\r\n`, 'yellow') + '\r\n');
      const join = await this.connection.getInput('  Join it? (Y/N): ');
      if (join && join.toUpperCase() === 'Y') {
        await this.enterChatRoom(normalized);
      }
      return;
    }

    const topic = await this.connection.getInput('  Topic (optional): ');

    createRoom(normalized, topic || '');
    this.connection.write(colorText(`\r\n  Room ${normalized} created!`, 'green', null, true) + '\r\n');

    const join = await this.connection.getInput('  Join now? (Y/N): ');
    if (join && join.toUpperCase() === 'Y') {
      await this.enterChatRoom(normalized);
    }
  }

  /**
   * Enter a chat room and run the interactive chat loop.
   * @param {string} roomName
   */
  async enterChatRoom(roomName) {
    const conn = this.connection;
    const username = this.user.username;

    // Join the room
    const room = roomJoin(roomName, conn);
    if (!room) {
      conn.write(colorText('\r\n  Room not found.\r\n', 'red'));
      conn.write(colorText('  Press any key to continue...', 'white') + '\r\n');
      await conn.getChar();
      return;
    }

    conn.setActivity('Chat: ' + room.name);

    // Show chat header
    this.screen.clear();
    conn.write('\r\n');
    conn.write(colorText(BOX.D_HORIZONTAL.repeat(60), 'cyan', null, true) + '\r\n');
    conn.write(colorText('  ' + room.name, 'green', null, true) +
      colorText(' - ' + room.topic, 'white') + '\r\n');
    conn.write(colorText('  Commands: /quit /who /topic /rooms', 'yellow') + '\r\n');
    conn.write(colorText(BOX.D_HORIZONTAL.repeat(60), 'cyan', null, true) + '\r\n\r\n');

    // Install chat message handler so incoming messages appear immediately
    conn.chatMessageHandler = (message) => {
      conn.write(message);
    };

    // Chat loop
    let inChat = true;

    while (inChat) {
      const line = await conn.getInput(colorText(username + '> ', 'green', null, true));

      if (line === null || line === undefined) {
        // Connection might be lost
        break;
      }

      const trimmed = line.trim();
      const lower = trimmed.toLowerCase();

      if (lower === '/quit' || lower === '/q') {
        inChat = false;
        break;
      }

      if (lower === '/who') {
        conn.write(colorText('\r\n  Users in ' + room.name + ':\r\n', 'yellow', null, true));
        for (const member of room.members) {
          const memberName = member.user ? member.user.username : 'Unknown';
          const node = member.nodeNumber != null ? member.nodeNumber : '?';
          conn.write(colorText('    Node ' + node + ': ', 'green', null, true) +
            colorText(memberName, 'cyan') + '\r\n');
        }
        conn.write('\r\n');
        continue;
      }

      if (lower.startsWith('/topic')) {
        const newTopic = trimmed.substring(6).trim();
        if (newTopic) {
          room.topic = newTopic;
          broadcastToRoom(roomName,
            colorText('*** ' + username + ' changed the topic to: ' + newTopic + ' ***', 'yellow', null, true) + '\r\n',
            null
          );
        } else {
          conn.write(colorText('  Topic: ' + room.topic, 'white') + '\r\n');
        }
        continue;
      }

      if (lower === '/rooms') {
        conn.write(colorText('\r\n  Active rooms:\r\n', 'yellow', null, true));
        for (const r of getRooms().values()) {
          conn.write(colorText('    ' + r.name.padEnd(16), 'cyan') +
            colorText(r.members.size + ' users  ', 'white', null, true) +
            colorText(r.topic, 'white') + '\r\n');
        }
        conn.write('\r\n');
        continue;
      }

      // Regular message — broadcast to all room members
      if (trimmed) {
        const msg = colorText('<' + username + '> ', 'cyan', null, true) +
          colorText(trimmed, 'white') + '\r\n';
        broadcastToRoom(roomName, msg, conn);
      }
    }

    // Cleanup: remove handler, leave room, restore activity
    conn.chatMessageHandler = null;
    roomLeave(roomName, conn);
    conn.setActivity('Main Menu');
  }

  // ─────────────────────────────────────────────────────────────
  //  Private paging (original functionality)
  // ─────────────────────────────────────────────────────────────

  /**
   * Show online users and let the caller pick a node to page.
   */
  async page() {
    const connections = getConnections();

    // Build list of other authenticated users
    const others = [...connections.values()]
      .filter(c => c.isAuthenticated() && c !== this.connection)
      .sort((a, b) => (a.nodeNumber || 0) - (b.nodeNumber || 0));

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  Chat / Page a User', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(57), 'cyan', null, true) + '\r\n');

    if (others.length === 0) {
      this.connection.write(colorText('  No other users are online to chat with.', 'white') + '\r\n\r\n');
      this.connection.write(colorText('  Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
      return;
    }

    // Display online users
    this.connection.write(
      colorText('  Node', 'white', null, true) + '  ' +
      colorText('Username', 'white', null, true) + '          ' +
      colorText('Activity', 'white', null, true) + '\r\n'
    );
    this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(57), 'cyan') + '\r\n');

    for (const conn of others) {
      const node = (conn.nodeNumber != null ? conn.nodeNumber.toString() : '?').padStart(4);
      const username = (conn.user.username || 'Guest').padEnd(18);
      const activity = (conn.activity || 'Unknown').padEnd(22);

      this.connection.write(
        colorText('  ' + node, 'green', null, true) + '  ' +
        colorText(username, 'cyan') +
        colorText(activity, 'white') + '\r\n'
      );
    }

    this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(57), 'cyan') + '\r\n\r\n');

    const input = await this.connection.getInput('  Enter node number to page (or ENTER to cancel): ');

    if (!input) return;

    const nodeNum = parseInt(input, 10);
    if (isNaN(nodeNum)) {
      this.screen.messageBox('Error', 'Invalid node number.', 'error');
      await this.connection.getChar();
      return;
    }

    const target = getConnectionByNode(nodeNum);
    if (!target || !target.isAuthenticated() || target === this.connection) {
      this.screen.messageBox('Error', 'That node is not available.', 'error');
      await this.connection.getChar();
      return;
    }

    // Send page request to target
    this.connection.write(colorText(`\r\n  Paging ${target.user.username} on Node ${nodeNum}... waiting for response.\r\n`, 'yellow', null, true));

    // Push a page request onto the target's queue
    const pagePromise = new Promise((resolve) => {
      target.pageQueue.push({
        from: this.connection,
        fromUsername: this.user.username,
        fromNode: this.connection.nodeNumber,
        resolve,
      });

      // Also notify the target immediately by writing to their socket
      target.write(
        '\r\n' +
        colorText('*** Page from ' + this.user.username + ' on Node ' + this.connection.nodeNumber + ' ***', 'yellow', null, true) +
        '\r\n' +
        colorText('    You have a pending chat request. It will appear at the next menu prompt.', 'white') +
        '\r\n'
      );

      // Timeout after PAGE_TIMEOUT_MS
      setTimeout(() => {
        resolve('timeout');
      }, PAGE_TIMEOUT_MS);
    });

    const result = await pagePromise;

    if (result === 'accepted') {
      // Enter chat mode with target
      await this.splitChat(target);
    } else if (result === 'declined') {
      this.connection.write(colorText('\r\n  User declined your page.\r\n', 'red', null, true));
      this.connection.write(colorText('  Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
    } else {
      // timeout
      // Remove the timed-out page from the target's queue
      target.pageQueue = target.pageQueue.filter(p => p.from !== this.connection);
      this.connection.write(colorText('\r\n  Page timed out — no response.\r\n', 'red', null, true));
      this.connection.write(colorText('  Press any key to continue...', 'white') + '\r\n');
      await this.connection.getChar();
    }
  }

  /**
   * Simple line-based chat between two connections.
   * Each user types a line; it appears on both screens prefixed with their username.
   * Type /quit or /q to end the chat.
   */
  async splitChat(targetConnection) {
    const myConn = this.connection;
    const theirConn = targetConnection;
    const myName = myConn.user.username;
    const theirName = theirConn.user.username;

    // Set activity for both
    myConn.setActivity('Chatting with ' + theirName);
    theirConn.setActivity('Chatting with ' + myName);

    // Mark as chat partners
    myConn.chatPartner = theirConn;
    theirConn.chatPartner = myConn;

    const chatHeader =
      '\r\n' +
      colorText(BOX.D_HORIZONTAL.repeat(60), 'cyan', null, true) + '\r\n' +
      colorText('  Chat Mode — type /quit or /q to end', 'yellow', null, true) + '\r\n' +
      colorText(BOX.D_HORIZONTAL.repeat(60), 'cyan', null, true) + '\r\n\r\n';

    myConn.write(chatHeader);
    theirConn.write(chatHeader);

    // We run two concurrent input loops. When either types /quit, we end both.
    let chatEnded = false;

    const chatLoop = async (conn, username, otherConn) => {
      while (!chatEnded) {
        const line = await conn.getInput(colorText(username + '> ', 'green', null, true));

        if (chatEnded) break;

        if (line.toLowerCase() === '/quit' || line.toLowerCase() === '/q') {
          chatEnded = true;
          conn.write(colorText('\r\n*** Chat ended ***\r\n', 'yellow', null, true));
          otherConn.write(colorText('\r\n*** ' + username + ' has left the chat ***\r\n', 'yellow', null, true));
          otherConn.write(colorText('*** Chat ended ***\r\n', 'yellow', null, true));
          break;
        }

        if (line) {
          // Show the message on the other user's screen
          const msg = colorText('<' + username + '> ', 'cyan', null, true) + colorText(line, 'white') + '\r\n';
          otherConn.write(msg);
        }
      }
    };

    // Run both loops concurrently — the first to /quit ends both
    await Promise.race([
      chatLoop(myConn, myName, theirConn),
      chatLoop(theirConn, theirName, myConn),
    ]);

    // Ensure chatEnded is set so the other loop will exit on its next iteration
    chatEnded = true;

    // Clean up chat state
    myConn.chatPartner = null;
    theirConn.chatPartner = null;

    // Signal the target's menu engine that chat is done
    if (theirConn._chatDoneResolve) {
      theirConn._chatDoneResolve();
      theirConn._chatDoneResolve = null;
    }

    // Give a moment for messages to flush, then let initiator return
    myConn.write(colorText('\r\n  Press any key to continue...', 'white') + '\r\n');
    await myConn.getChar();
  }
}

export default ChatService;
