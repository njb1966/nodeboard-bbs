/**
 * Main Menu
 */
import { colorText } from '../../utils/ansi.js';
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
    while (true) {
      const unreadMail = this.user.getUnreadMessageCount();
      const mailIndicator = unreadMail > 0 ? ` (${unreadMail} new)` : '';

      const menuItems = [
        { key: 'M', text: 'Message Forums' },
        { key: 'P', text: `Private Mail${mailIndicator}` },
        { key: 'F', text: 'File Areas' },
        { key: 'D', text: 'Door Games' },
        { key: 'U', text: 'User List' },
        { key: 'W', text: 'Who\'s Online' },
        { key: 'B', text: 'Bulletins' },
        { key: 'S', text: 'User Settings' },
        { key: 'G', text: 'Goodbye (Logoff)' },
      ];

      // Add sysop menu for sysops
      if (this.user.isSysop()) {
        menuItems.splice(8, 0, { key: 'A', text: 'Sysop Admin' });
      }

      this.screen.menu('MAIN MENU', menuItems, 'Command');

      const choice = (await this.connection.getInput()).toUpperCase();

      switch (choice) {
        case 'M':
          await this.messageForums();
          break;

        case 'P':
          await this.privateMail();
          break;

        case 'F':
          await this.fileAreas();
          break;

        case 'D':
          await this.doorGames();
          break;

        case 'U':
          await this.userList();
          break;

        case 'W':
          await this.whosOnline();
          break;

        case 'B':
          await this.bulletins();
          break;

        case 'S':
          await this.userSettings();
          break;

        case 'A':
          if (this.user.isSysop()) {
            await this.sysopAdmin();
          }
          break;

        case 'G':
        case 'Q':
          await this.goodbye();
          return;

        default:
          this.screen.messageBox('Error', 'Invalid selection. Please try again.', 'error');
          await this.connection.getChar();
      }
    }
  }

  /**
   * Message forums
   */
  async messageForums() {
    const forumService = new ForumService(this.connection);
    await forumService.show();
  }

  /**
   * Private mail
   */
  async privateMail() {
    const messageService = new MessageService(this.connection);
    await messageService.show();
  }

  /**
   * File areas
   */
  async fileAreas() {
    const fileService = new FileService(this.connection);
    await fileService.show();
  }

  /**
   * Door games
   */
  async doorGames() {
    const doorService = new DoorService(this.connection);
    await doorService.show();
  }

  /**
   * User list
   */
  async userList() {
    const userService = new UserService(this.connection);
    await userService.showUserList();
  }

  /**
   * Who's online
   */
  async whosOnline() {
    const userService = new UserService(this.connection);
    await userService.showWhosOnline();
  }

  /**
   * Bulletins
   */
  async bulletins() {
    const userService = new UserService(this.connection);
    await userService.showBulletins();
  }

  /**
   * User settings
   */
  async userSettings() {
    const userService = new UserService(this.connection);
    await userService.showSettings();
  }

  /**
   * Sysop admin
   */
  async sysopAdmin() {
    const sysopService = new SysopService(this.connection);
    await sysopService.show();
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
