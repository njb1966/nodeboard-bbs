/**
 * Main Menu
 *
 * Uses the config-driven MenuEngine to render and dispatch the main menu.
 * Menu items are defined in src/config/menus/main.json.
 */
import { colorText } from '../../utils/ansi.js';
import { loadMenu } from './MenuLoader.js';
import { MenuEngine } from './MenuEngine.js';
import { ForumService } from '../ForumService.js';
import { MessageService } from '../MessageService.js';
import { FileService } from '../FileService.js';
import { DoorService } from '../DoorService.js';
import { UserService } from '../UserService.js';
import { SysopService } from '../SysopService.js';

export class MainMenu {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show main menu
   */
  async show() {
    const menuDef = loadMenu('main');
    const engine = new MenuEngine(this.connection, menuDef);

    // Register all action handlers

    engine.registerAction('forums', async () => {
      const forumService = new ForumService(this.connection);
      await forumService.show();
    });

    engine.registerAction('mail', async () => {
      const messageService = new MessageService(this.connection);
      await messageService.show();
    });

    engine.registerAction('files', async () => {
      const fileService = new FileService(this.connection);
      await fileService.show();
    });

    engine.registerAction('doors', async () => {
      const doorService = new DoorService(this.connection);
      await doorService.show();
    });

    engine.registerAction('userList', async () => {
      const userService = new UserService(this.connection);
      await userService.showUserList();
    });

    engine.registerAction('whosOnline', async () => {
      const userService = new UserService(this.connection);
      await userService.showWhosOnline();
    });

    engine.registerAction('bulletins', async () => {
      const userService = new UserService(this.connection);
      await userService.showBulletins();
    });

    engine.registerAction('settings', async () => {
      const userService = new UserService(this.connection);
      await userService.showSettings();
    });

    engine.registerAction('sysopAdmin', async () => {
      const sysopService = new SysopService(this.connection);
      await sysopService.show();
    });

    engine.registerAction('goodbye', async () => {
      await this.goodbye();
      return 'exit';
    });

    await engine.show();
  }

  /**
   * Goodbye
   */
  async goodbye() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('Thank you for calling ' + this.connection.user.username + '!', 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('You were online for ' + Math.floor(this.connection.session.getDuration() / 60) + ' minutes.', 'white') + '\r\n');
    this.connection.write(colorText('Come back soon!', 'yellow', null, true) + '\r\n\r\n');
    this.connection.socket.end();
  }
}

export default MainMenu;
