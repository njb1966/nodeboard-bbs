/**
 * Menu Engine
 *
 * Config-driven menu renderer and dispatcher. Takes a connection and a menu
 * definition object, renders the menu via BBSScreen.menu(), resolves badges,
 * filters items by security level, and dispatches actions through a registry.
 */

/**
 * Badge resolver functions.
 * Each key maps a badge name (from the menu JSON) to a function that receives
 * the connection and returns the badge string to append to the menu item text.
 */
const defaultBadgeResolvers = {
  unreadMail: (connection) => {
    const count = connection.user.getUnreadMessageCount();
    return count > 0 ? ` (${count} new)` : '';
  },
};

export class MenuEngine {
  /**
   * @param {object} connection - BBS connection object
   * @param {object} menuDef - Parsed menu definition from MenuLoader
   */
  constructor(connection, menuDef) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
    this.menuDef = menuDef;

    /** @type {Map<string, function>} */
    this.actions = new Map();

    /** @type {object} */
    this.badgeResolvers = { ...defaultBadgeResolvers };
  }

  /**
   * Register an action handler
   * @param {string} name - Action name (matches "action" field in menu JSON)
   * @param {function} handler - Async function to execute when action is selected
   */
  registerAction(name, handler) {
    this.actions.set(name, handler);
  }

  /**
   * Register a custom badge resolver
   * @param {string} name - Badge name (matches "badge" field in menu JSON)
   * @param {function} resolver - Function(connection) => string
   */
  registerBadge(name, resolver) {
    this.badgeResolvers[name] = resolver;
  }

  /**
   * Build the visible menu items, filtering by security level and resolving badges
   * @returns {Array<{key: string, text: string, action: string}>}
   */
  buildMenuItems() {
    const userLevel = this.user.security_level || 0;

    return this.menuDef.items
      .filter(item => {
        if (item.minSecurity && userLevel < item.minSecurity) {
          return false;
        }
        return true;
      })
      .map(item => {
        let text = item.text;

        // Resolve badge if specified
        if (item.badge && this.badgeResolvers[item.badge]) {
          text += this.badgeResolvers[item.badge](this.connection);
        }

        return { key: item.key, text, action: item.action };
      });
  }

  /**
   * Run the menu loop. Renders the menu, waits for input, dispatches the
   * matching action. Returns when a "goodbye" or "quit" action is triggered,
   * or when the registered handler returns a truthy value to signal exit.
   */
  async show() {
    while (true) {
      const items = this.buildMenuItems();

      this.screen.menu(
        this.menuDef.title,
        items,
        this.menuDef.prompt || 'Selection',
      );

      const choice = (await this.connection.getInput()).toUpperCase();

      const selected = items.find(item => item.key === choice);

      if (!selected) {
        this.screen.messageBox('Error', 'Invalid selection. Please try again.', 'error');
        await this.connection.getChar();
        continue;
      }

      const handler = this.actions.get(selected.action);

      if (!handler) {
        this.screen.messageBox('Error', 'That feature is not available.', 'error');
        await this.connection.getChar();
        continue;
      }

      const result = await handler();

      // A handler can return 'exit' to break out of the menu loop
      if (result === 'exit') {
        return;
      }
    }
  }
}

export default MenuEngine;
