/**
 * Chat Room Manager — Module-level singleton for multi-user chat rooms
 *
 * Manages shared chat rooms across all connections. Rooms persist in memory
 * as long as the server is running. Permanent rooms cannot be deleted.
 */
import { colorText } from '../utils/ansi.js';

/** @type {Map<string, object>} name -> room object */
const rooms = new Map();

// Create default room
rooms.set('#lobby', {
  name: '#lobby',
  topic: 'General chat',
  members: new Set(),
  created: Date.now(),
  isPermanent: true,
});

/**
 * Get all rooms.
 * @returns {Map<string, object>}
 */
export function getRooms() {
  return rooms;
}

/**
 * Get a specific room by name.
 * @param {string} name
 * @returns {object|undefined}
 */
export function getRoom(name) {
  return rooms.get(name);
}

/**
 * Create a new chat room.
 * @param {string} name - Must start with #
 * @param {string} topic
 * @returns {object} The created room
 */
export function createRoom(name, topic = '') {
  const normalized = name.startsWith('#') ? name.toLowerCase() : '#' + name.toLowerCase();

  if (rooms.has(normalized)) {
    return rooms.get(normalized);
  }

  const room = {
    name: normalized,
    topic: topic || 'No topic set',
    members: new Set(),
    created: Date.now(),
    isPermanent: false,
  };

  rooms.set(normalized, room);
  return room;
}

/**
 * Delete a non-permanent room.
 * @param {string} name
 * @returns {boolean} true if deleted
 */
export function deleteRoom(name) {
  const room = rooms.get(name);
  if (!room) return false;
  if (room.isPermanent) return false;
  if (room.members.size > 0) return false;

  rooms.delete(name);
  return true;
}

/**
 * Add a user (connection) to a room. Broadcasts join message to existing members.
 * @param {string} name
 * @param {object} connection
 * @returns {object|null} The room, or null if not found
 */
export function joinRoom(name, connection) {
  const room = rooms.get(name);
  if (!room) return null;

  if (room.members.has(connection)) {
    return room; // already in the room
  }

  const username = connection.user ? connection.user.username : 'Unknown';
  broadcastToRoom(name,
    colorText(`*** ${username} has joined ${room.name} ***`, 'yellow', null, true) + '\r\n',
    null
  );

  room.members.add(connection);
  return room;
}

/**
 * Remove a user (connection) from a room. Broadcasts leave message.
 * Auto-deletes non-permanent rooms that become empty.
 * @param {string} name
 * @param {object} connection
 */
export function leaveRoom(name, connection) {
  const room = rooms.get(name);
  if (!room) return;

  if (!room.members.has(connection)) return;

  room.members.delete(connection);

  const username = connection.user ? connection.user.username : 'Unknown';
  broadcastToRoom(name,
    colorText(`*** ${username} has left ${room.name} ***`, 'yellow', null, true) + '\r\n',
    null
  );

  // Auto-delete empty non-permanent rooms
  if (room.members.size === 0 && !room.isPermanent) {
    rooms.delete(name);
  }
}

/**
 * Send a message to all members of a room, optionally excluding one connection.
 * Uses each connection's chatMessageHandler if set, otherwise writes directly.
 * @param {string} name
 * @param {string} message
 * @param {object|null} excludeConnection
 */
export function broadcastToRoom(name, message, excludeConnection) {
  const room = rooms.get(name);
  if (!room) return;

  for (const member of room.members) {
    if (member === excludeConnection) continue;

    if (member.chatMessageHandler) {
      member.chatMessageHandler(message);
    } else {
      member.write(message);
    }
  }
}

/**
 * Get list of rooms a connection is a member of.
 * @param {object} connection
 * @returns {object[]} Array of room objects
 */
export function getUserRooms(connection) {
  const result = [];
  for (const room of rooms.values()) {
    if (room.members.has(connection)) {
      result.push(room);
    }
  }
  return result;
}

/**
 * Remove a connection from ALL rooms. Used during disconnect cleanup.
 * @param {object} connection
 */
export function removeFromAllRooms(connection) {
  for (const [name] of rooms) {
    leaveRoom(name, connection);
  }
  // Clear handler
  connection.chatMessageHandler = null;
}
