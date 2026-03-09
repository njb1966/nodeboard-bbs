/**
 * Theme / Skin Service
 *
 * Loads JSON theme definitions from the themes/ directory and exposes
 * the active theme's colour mapping for use by screen rendering.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, basename } from 'path';
import config from '../config/index.js';

const THEMES_DIR = join(config.paths.root, 'themes');
const ACTIVE_THEME_FILE = join(config.paths.data, 'active_theme.txt');

/** In-memory cache of the active theme object */
let activeTheme = null;

/**
 * Ensure the themes directory exists.
 */
function ensureThemesDir() {
  if (!existsSync(THEMES_DIR)) {
    mkdirSync(THEMES_DIR, { recursive: true });
  }
}

/**
 * Load a theme by name (filename without .json).
 * @param {string} name
 * @returns {object|null}
 */
export function loadTheme(name) {
  ensureThemesDir();
  const filePath = join(THEMES_DIR, `${name}.json`);
  if (!existsSync(filePath)) return null;
  try {
    return JSON.parse(readFileSync(filePath, 'utf8'));
  } catch (err) {
    console.error(`[ThemeService] Failed to load theme "${name}":`, err.message);
    return null;
  }
}

/**
 * List all available theme names.
 * @returns {string[]}
 */
export function listThemes() {
  ensureThemesDir();
  return readdirSync(THEMES_DIR)
    .filter(f => f.endsWith('.json'))
    .map(f => basename(f, '.json'));
}

/**
 * Get the currently active theme object.
 * Falls back to the built-in default if nothing is configured.
 * @returns {object}
 */
export function getActiveTheme() {
  if (activeTheme) return activeTheme;

  // Try to read persisted selection
  let name = 'default';
  if (existsSync(ACTIVE_THEME_FILE)) {
    try {
      name = readFileSync(ACTIVE_THEME_FILE, 'utf8').trim() || 'default';
    } catch (_) { /* ignore */ }
  }

  activeTheme = loadTheme(name);
  if (!activeTheme) {
    // Return a hardcoded fallback so nothing breaks
    activeTheme = builtinDefault();
  }
  return activeTheme;
}

/**
 * Set the active theme (persisted across restarts).
 * @param {string} name
 * @returns {boolean} true if successful
 */
export function setActiveTheme(name) {
  const theme = loadTheme(name);
  if (!theme) return false;
  activeTheme = theme;
  try {
    writeFileSync(ACTIVE_THEME_FILE, name, 'utf8');
  } catch (err) {
    console.error('[ThemeService] Could not persist theme selection:', err.message);
  }
  return true;
}

/**
 * Built-in default theme (used when no JSON file is available).
 */
function builtinDefault() {
  return {
    name: 'Default',
    author: 'System',
    colors: {
      header:     { fg: 'cyan',    bright: true },
      menuBorder: { fg: 'cyan',    bright: true },
      menuTitle:  { fg: 'yellow',  bright: true },
      menuItem:   { fg: 'white',   bright: false },
      menuKey:    { fg: 'green',   bright: true },
      prompt:     { fg: 'yellow',  bright: true },
      text:       { fg: 'white',   bright: false },
      error:      { fg: 'red',     bright: true },
      success:    { fg: 'green',   bright: true },
      info:       { fg: 'cyan',    bright: false },
    },
    art: {
      welcome: '',
      goodbye: '',
      login: '',
    },
  };
}

export default { loadTheme, listThemes, getActiveTheme, setActiveTheme };
