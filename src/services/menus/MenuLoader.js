/**
 * Menu Loader
 *
 * Loads menu definitions from JSON config files in src/config/menus/.
 * Validates required fields and caches loaded menus.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const menusDir = join(__dirname, '../../config/menus');

/** @type {Map<string, object>} */
const menuCache = new Map();

/**
 * Validate a menu definition has required fields
 * @param {object} menu - Parsed menu definition
 * @param {string} menuId - Menu identifier (for error messages)
 * @throws {Error} If required fields are missing
 */
function validateMenu(menu, menuId) {
  if (!menu.id) {
    throw new Error(`Menu "${menuId}" is missing required field: id`);
  }
  if (!menu.title) {
    throw new Error(`Menu "${menuId}" is missing required field: title`);
  }
  if (!Array.isArray(menu.items)) {
    throw new Error(`Menu "${menuId}" is missing required field: items (must be an array)`);
  }

  for (const item of menu.items) {
    if (!item.key) {
      throw new Error(`Menu "${menuId}" has an item missing required field: key`);
    }
    if (!item.text) {
      throw new Error(`Menu "${menuId}" has an item missing required field: text`);
    }
  }
}

/**
 * Load a menu definition by ID
 * @param {string} menuId - Menu identifier (matches the JSON filename without extension)
 * @returns {object} Parsed and validated menu definition
 * @throws {Error} If the menu file cannot be found or is invalid
 */
export function loadMenu(menuId) {
  if (menuCache.has(menuId)) {
    return menuCache.get(menuId);
  }

  const filePath = join(menusDir, `${menuId}.json`);

  let raw;
  try {
    raw = readFileSync(filePath, 'utf8');
  } catch (err) {
    throw new Error(`Menu file not found: ${filePath}`);
  }

  let menu;
  try {
    menu = JSON.parse(raw);
  } catch (err) {
    throw new Error(`Invalid JSON in menu file "${filePath}": ${err.message}`);
  }

  validateMenu(menu, menuId);
  menuCache.set(menuId, menu);

  return menu;
}

/**
 * Clear the menu cache (useful for hot-reloading in development)
 */
export function clearMenuCache() {
  menuCache.clear();
}

/**
 * Reload a specific menu from disk, bypassing cache
 * @param {string} menuId - Menu identifier
 * @returns {object} Freshly loaded menu definition
 */
export function reloadMenu(menuId) {
  menuCache.delete(menuId);
  return loadMenu(menuId);
}

export default { loadMenu, clearMenuCache, reloadMenu };
