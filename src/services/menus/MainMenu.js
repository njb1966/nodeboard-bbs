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
import { OneLinerService } from '../OneLinerService.js';
import { PollService } from '../PollService.js';
import { ChatService } from '../ChatService.js';
import { GameService } from '../GameService.js';
import { RSSService } from '../RSSService.js';

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
      this.connection.setActivity('Reading Forums');
      const forumService = new ForumService(this.connection);
      await forumService.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('newScan', async () => {
      this.connection.setActivity('Reading Forums');
      const forumService = new ForumService(this.connection);
      await forumService.newScan();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('mail', async () => {
      this.connection.setActivity('Reading Mail');
      const messageService = new MessageService(this.connection);
      await messageService.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('files', async () => {
      this.connection.setActivity('Browsing Files');
      const fileService = new FileService(this.connection);
      await fileService.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('newFileScan', async () => {
      this.connection.setActivity('New File Scan');
      const fileService = new FileService(this.connection);
      await fileService.newFilesScan();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('doors', async () => {
      this.connection.setActivity('Playing Door Games');
      const doorService = new DoorService(this.connection);
      await doorService.show();
      this.connection.setActivity('Main Menu');
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
      this.connection.setActivity('User Settings');
      const userService = new UserService(this.connection);
      await userService.showSettings();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('sysopAdmin', async () => {
      this.connection.setActivity('Sysop Admin');
      const sysopService = new SysopService(this.connection);
      await sysopService.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('oneliners', async () => {
      this.connection.setActivity('OneLiners');
      const service = new OneLinerService(this.connection);
      await service.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('polls', async () => {
      this.connection.setActivity('Voting Booth');
      const service = new PollService(this.connection);
      await service.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('games', async () => {
      this.connection.setActivity('Playing Games');
      const gameService = new GameService(this.connection);
      await gameService.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('rss', async () => {
      this.connection.setActivity('Reading RSS Feeds');
      const rssService = new RSSService(this.connection);
      await rssService.show();
      this.connection.setActivity('Main Menu');
    });

    engine.registerAction('chat', async () => {
      this.connection.setActivity('Chat/Paging');
      const chatService = new ChatService(this.connection);
      await chatService.show();
      this.connection.setActivity('Main Menu');
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
