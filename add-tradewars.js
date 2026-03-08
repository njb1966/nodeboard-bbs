/**
 * Add TradeWars 2002 to the database
 */
import Database from 'better-sqlite3';
import config from './src/config/index.js';
import { join } from 'path';

const db = new Database(config.database.path);
db.pragma('foreign_keys = ON');

console.log('Adding TradeWars 2002 to door games...');

// Check if TradeWars already exists
const existing = db.prepare('SELECT * FROM doors WHERE name = ?').get('TradeWars 2002');

if (existing) {
  console.log('TradeWars 2002 already exists in database. Updating...');
  db.prepare(`
    UPDATE doors
    SET description = ?,
        command = ?,
        working_dir = ?,
        enabled = 1
    WHERE name = ?
  `).run(
    'TradeWars 2002 - Classic space trading and combat game. Build your empire, trade goods, and battle other players in the depths of space!',
    'launch-tw-dosbox-x.bat',
    join(config.paths.doors, 'tw'),
    'TradeWars 2002'
  );
  console.log('TradeWars 2002 updated successfully!');
  console.log('NOTE: Using DOSBox-X launcher (launch-tw-dosbox-x.bat)');
} else {
  console.log('Inserting TradeWars 2002...');
  db.prepare(`
    INSERT INTO doors (name, description, command, working_dir, security_level, enabled)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    'TradeWars 2002',
    'TradeWars 2002 - Classic space trading and combat game. Build your empire, trade goods, and battle other players in the depths of space!',
    'launch-tw-dosbox-x.bat',
    join(config.paths.doors, 'tw'),
    10,
    1
  );
  console.log('TradeWars 2002 added successfully!');
  console.log('NOTE: Using DOSBox-X launcher (launch-tw-dosbox-x.bat)');
}

// List all doors
console.log('\nCurrent door games:');
const doors = db.prepare('SELECT * FROM doors').all();
doors.forEach(door => {
  console.log(`  - ${door.name} (${door.enabled ? 'ENABLED' : 'DISABLED'})`);
  console.log(`    Command: ${door.command}`);
  console.log(`    Working Dir: ${door.working_dir}`);
  console.log('');
});

db.close();
console.log('Done!');
