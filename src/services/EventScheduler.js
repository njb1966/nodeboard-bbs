/**
 * Event Scheduler Service — singleton
 *
 * Loads scheduled_events from the database, checks every 60 seconds
 * whether any are due, and runs built-in commands.
 */
import getDatabase from '../database/db.js';
import { Session } from '../models/Session.js';
import { logEvent } from './LogService.js';
import config from '../config/index.js';
import { existsSync, copyFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

/** Singleton state */
let intervalHandle = null;

// ────────────────────────── Built-in commands ──────────────────────────

const COMMANDS = {
  cleanup_sessions: async () => {
    Session.cleanup();
    return 'Cleaned up stale sessions';
  },

  expire_bulletins: async () => {
    const db = getDatabase();
    const result = db.prepare(
      "DELETE FROM bulletins WHERE expires_at IS NOT NULL AND expires_at < datetime('now')"
    ).run();
    return `Expired ${result.changes} bulletin(s)`;
  },

  expire_download_tokens: async () => {
    // Tokens are in-memory (DownloadTokenService) and self-clean.
    // This is a no-op placeholder that logs the action.
    return 'Download token cleanup triggered (in-memory, auto-expiring)';
  },

  log_stats: async () => {
    const db = getDatabase();
    const users = db.prepare('SELECT COUNT(*) as c FROM users').get().c;
    const posts = db.prepare('SELECT COUNT(*) as c FROM messages').get().c;
    const sessions = db.prepare("SELECT COUNT(*) as c FROM sessions WHERE status = 'active'").get().c;
    const msg = `Stats snapshot — Users: ${users}, Posts: ${posts}, Active sessions: ${sessions}`;
    logEvent('SYSTEM', null, null, msg);
    return msg;
  },

  backup_db: async () => {
    const src = config.database.path;
    const backupDir = join(dirname(src), 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const dest = join(backupDir, `bbs-${timestamp}.db`);
    copyFileSync(src, dest);
    return `Database backed up to ${dest}`;
  },
};

/** List of available command names (for UI). */
export function getAvailableCommands() {
  return Object.keys(COMMANDS);
}

// ───────────────────── Schedule helpers ──────────────────────

/**
 * Compute the next run time for an event given its schedule_type and schedule_value.
 * @returns {Date}
 */
function computeNextRun(scheduleType, scheduleValue, fromDate = new Date()) {
  const now = fromDate;

  if (scheduleType === 'interval') {
    const minutes = parseInt(scheduleValue, 10) || 60;
    return new Date(now.getTime() + minutes * 60_000);
  }

  if (scheduleType === 'daily') {
    // schedule_value = "HH:MM"
    const [hh, mm] = scheduleValue.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hh, mm, 0, 0);
    if (next <= now) next.setDate(next.getDate() + 1);
    return next;
  }

  if (scheduleType === 'weekly') {
    // schedule_value = "day,HH:MM"  (day = 0-6, Sun-Sat)
    const [dayStr, time] = scheduleValue.split(',');
    const day = parseInt(dayStr, 10);
    const [hh, mm] = time.split(':').map(Number);
    const next = new Date(now);
    next.setHours(hh, mm, 0, 0);
    const diff = (day - now.getDay() + 7) % 7 || 7; // at least 1 day ahead
    if (diff === 7 && next > now) {
      // Same weekday, hasn't passed yet today
    } else {
      next.setDate(next.getDate() + diff);
    }
    // Edge: if same day and time already passed, move forward a week
    if (next <= now) next.setDate(next.getDate() + 7);
    return next;
  }

  // Fallback: 1 hour from now
  return new Date(now.getTime() + 3_600_000);
}

// ──────────────────── Core scheduler ────────────────────

/**
 * Check all enabled events and run those that are due.
 */
function checkEvents() {
  try {
    const db = getDatabase();
    const events = db.prepare(
      "SELECT * FROM scheduled_events WHERE enabled = 1"
    ).all();

    const now = new Date();

    for (const evt of events) {
      // Determine if it's time to run
      let shouldRun = false;

      if (!evt.next_run) {
        // Never computed — run now
        shouldRun = true;
      } else {
        const nextRun = new Date(evt.next_run);
        if (now >= nextRun) shouldRun = true;
      }

      if (shouldRun) {
        executeEvent(evt).catch(err => {
          console.error(`[EventScheduler] Error running "${evt.name}":`, err.message);
        });
      }
    }
  } catch (err) {
    console.error('[EventScheduler] checkEvents error:', err.message);
  }
}

/**
 * Execute a single event's command and update its timestamps.
 */
async function executeEvent(evt) {
  const handler = COMMANDS[evt.command];
  if (!handler) {
    console.warn(`[EventScheduler] Unknown command "${evt.command}" for event "${evt.name}"`);
    return;
  }

  try {
    const result = await handler();
    const db = getDatabase();
    const nextRun = computeNextRun(evt.schedule_type, evt.schedule_value);

    db.prepare(
      "UPDATE scheduled_events SET last_run = datetime('now'), next_run = ? WHERE id = ?"
    ).run(nextRun.toISOString(), evt.id);

    logEvent('SYSTEM', null, null, `Scheduled event "${evt.name}": ${result}`);
  } catch (err) {
    logEvent('ERROR', null, null, `Scheduled event "${evt.name}" failed: ${err.message}`);
    throw err;
  }
}

// ──────────────────── Public API ────────────────────

/**
 * Start the scheduler (call once at boot).
 */
export function start() {
  if (intervalHandle) return; // Already running

  console.log('[EventScheduler] Starting event scheduler (60s interval)');
  // Run an initial check shortly after boot
  setTimeout(() => checkEvents(), 5_000);
  intervalHandle = setInterval(() => checkEvents(), 60_000);
  intervalHandle.unref(); // Don't keep process alive just for this
}

/**
 * Stop the scheduler.
 */
export function stop() {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
    console.log('[EventScheduler] Stopped');
  }
}

export default { start, stop, getAvailableCommands };
