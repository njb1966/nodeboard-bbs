/**
 * RSS Feed Reader Service
 *
 * Fetches and displays RSS feeds within the BBS terminal interface.
 * Caches feeds in memory with a 15-minute TTL.
 */
import Parser from 'rss-parser';
import getDatabase from '../database/db.js';
import { colorText, BOX, padText } from '../utils/ansi.js';
import { wordWrap } from '../utils/text.js';

// ─── Feed Cache ──────────────────────────────────────────────────────────────

const CACHE_TTL = 15 * 60 * 1000; // 15 minutes
const feedCache = new Map();

/**
 * Get a feed from cache or fetch it fresh.
 * @param {string} url
 * @returns {Promise<object>}
 */
async function getCachedFeed(url) {
  const cached = feedCache.get(url);
  if (cached && (Date.now() - cached.fetchedAt) < CACHE_TTL) {
    return cached.data;
  }

  const parser = new Parser({
    timeout: 15000,
    headers: {
      'User-Agent': 'NodeBoard-BBS/1.1 RSS Reader',
    },
  });

  const data = await parser.parseURL(url);
  feedCache.set(url, { data, fetchedAt: Date.now() });
  return data;
}

// ─── RSSService Class ────────────────────────────────────────────────────────

export class RSSService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show the RSS Feed Reader menu.
   */
  async show() {
    while (true) {
      const db = getDatabase();
      const feeds = db.prepare(`
        SELECT * FROM rss_feeds
        WHERE enabled = 1 AND security_level <= ?
        ORDER BY name
      `).all(this.user.security_level);

      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('  RSS Feed Reader', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(27), 'cyan', null, true) + '\r\n\r\n');

      if (feeds.length === 0) {
        this.connection.write(colorText('  No feeds configured. Ask your sysop to add some!', 'white') + '\r\n\r\n');
        this.connection.write(colorText('  Press any key to continue...', 'cyan'));
        await this.connection.getChar();
        return;
      }

      for (let i = 0; i < feeds.length; i++) {
        this.connection.write(
          colorText('  [', 'white') +
          colorText(`${i + 1}`, 'cyan', null, true) +
          colorText('] ', 'white') +
          colorText(feeds[i].name, 'white', null, true) +
          '\r\n'
        );
      }

      this.connection.write(
        colorText('  [', 'white') +
        colorText('Q', 'cyan', null, true) +
        colorText('] ', 'white') +
        colorText('Quit', 'white', null, true) +
        '\r\n'
      );

      this.connection.write('\r\n');
      const choice = await this.connection.getInput('  Your choice: ');

      if (choice.toUpperCase() === 'Q') return;

      const idx = parseInt(choice) - 1;
      if (idx >= 0 && idx < feeds.length) {
        await this.viewFeed(feeds[idx]);
      }
    }
  }

  /**
   * View a single feed's articles.
   */
  async viewFeed(feed) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText(`  Fetching ${feed.name}...`, 'cyan') + '\r\n');

    let feedData;
    try {
      feedData = await getCachedFeed(feed.url);
    } catch (err) {
      this.connection.write(colorText(`  Error fetching feed: ${err.message}`, 'red') + '\r\n\r\n');
      this.connection.write(colorText('  Press any key to continue...', 'cyan'));
      await this.connection.getChar();
      return;
    }

    // Update last_fetched
    const db = getDatabase();
    db.prepare("UPDATE rss_feeds SET last_fetched = datetime('now') WHERE id = ?").run(feed.id);

    const articles = (feedData.items || []).slice(0, 20);

    while (true) {
      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText(`  ${feed.name} - Latest Articles`, 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(55), 'cyan', null, true) + '\r\n\r\n');

      if (articles.length === 0) {
        this.connection.write(colorText('  No articles available.', 'white') + '\r\n\r\n');
        this.connection.write(colorText('  Press any key to continue...', 'cyan'));
        await this.connection.getChar();
        return;
      }

      for (let i = 0; i < articles.length; i++) {
        const article = articles[i];
        const title = (article.title || 'Untitled').substring(0, 55);
        const timeAgo = this.formatTimeAgo(article.pubDate || article.isoDate);

        this.connection.write(
          colorText(`  ${String(i + 1).padStart(2)}.`, 'green', null, true) +
          colorText(` ${padText(title, 56)}`, 'white') +
          colorText(timeAgo.padStart(8), 'cyan') +
          '\r\n'
        );
      }

      this.connection.write('\r\n');
      this.connection.write(colorText('  [#] Read article  [Q] Back: ', 'yellow', null, true));

      const choice = await this.connection.getInput('');

      if (choice.toUpperCase() === 'Q') return;

      const articleIdx = parseInt(choice) - 1;
      if (articleIdx >= 0 && articleIdx < articles.length) {
        await this.readArticle(articles[articleIdx], feed.name);
      }
    }
  }

  /**
   * Display a single article.
   */
  async readArticle(article, feedName) {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(76), 'cyan', null, true) + '\r\n');
    this.connection.write(colorText(`  ${feedName}`, 'cyan') + '\r\n');
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(76), 'cyan', null, true) + '\r\n\r\n');

    // Title
    this.connection.write(colorText(`  ${article.title || 'Untitled'}`, 'yellow', null, true) + '\r\n\r\n');

    // Date
    if (article.pubDate || article.isoDate) {
      const date = new Date(article.pubDate || article.isoDate);
      this.connection.write(colorText(`  Published: ${date.toLocaleString()}`, 'white') + '\r\n');
    }

    // Author
    if (article.creator || article.author) {
      this.connection.write(colorText(`  Author: ${article.creator || article.author}`, 'white') + '\r\n');
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(76), 'cyan') + '\r\n\r\n');

    // Content / summary
    const content = article.contentSnippet || article.content || article.summary || 'No content available.';
    // Strip HTML tags and decode basic entities
    const cleanContent = this.stripHtml(content);
    const wrapped = wordWrap(cleanContent, 74);

    // Indent each line
    const lines = wrapped.split('\r\n');
    for (const line of lines) {
      this.connection.write('  ' + line + '\r\n');
    }

    this.connection.write('\r\n');

    // URL
    if (article.link) {
      this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(76), 'cyan') + '\r\n');
      this.connection.write(colorText('  URL: ', 'white', null, true) + colorText(article.link, 'cyan') + '\r\n');
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('  Press any key to continue...', 'white'));
    await this.connection.getChar();
  }

  /**
   * Format a date as relative time (e.g., "2h ago").
   */
  formatTimeAgo(dateStr) {
    if (!dateStr) return '';
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diff = now - then;

    if (diff < 0) return 'now';

    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'now';
    if (minutes < 60) return `${minutes}m ago`;

    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;

    const days = Math.floor(hours / 24);
    if (days < 30) return `${days}d ago`;

    const months = Math.floor(days / 30);
    return `${months}mo ago`;
  }

  /**
   * Strip HTML tags and decode common entities.
   */
  stripHtml(html) {
    return html
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<\/p>/gi, '\n\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&nbsp;/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }
}

export default RSSService;
