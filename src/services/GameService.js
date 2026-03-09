/**
 * Built-in Text Games Service
 *
 * Provides Trivia Challenge, Hangman, and Number Guesser
 * with persistent leaderboards stored in game_scores.
 */
import getDatabase from '../database/db.js';
import { ANSI, BOX, colorText, padText } from '../utils/ansi.js';
import { queueScoreForSync, isNetworkConfigured, getNetworkScores } from './NetworkService.js';

// ─── Trivia Questions ──────────────────────────────────────────────────────────

const TRIVIA_QUESTIONS = [
  // BBS / Computers
  { question: 'What year was the first BBS created?', options: ['A) 1976', 'B) 1978', 'C) 1980', 'D) 1982'], answer: 'B', category: 'BBS' },
  { question: 'Who created the first BBS (CBBS)?', options: ['A) Bill Gates', 'B) Ward Christensen', 'C) Steve Jobs', 'D) Linus Torvalds'], answer: 'B', category: 'BBS' },
  { question: 'What file transfer protocol was commonly used on BBSes?', options: ['A) HTTP', 'B) FTP', 'C) ZMODEM', 'D) SMTP'], answer: 'C', category: 'BBS' },
  { question: 'What does BBS stand for?', options: ['A) Basic Binary System', 'B) Bulletin Board System', 'C) Broadband Base Station', 'D) Binary Broadcast Service'], answer: 'B', category: 'BBS' },
  { question: 'What classic BBS door game involves space trading?', options: ['A) Legend of the Red Dragon', 'B) TradeWars 2002', 'C) Barren Realms Elite', 'D) Usurper'], answer: 'B', category: 'BBS' },
  { question: 'What terminal emulation standard uses escape codes for colors?', options: ['A) ASCII', 'B) EBCDIC', 'C) ANSI', 'D) Unicode'], answer: 'C', category: 'BBS' },
  { question: 'FidoNet was a network for transferring what between BBSes?', options: ['A) Files only', 'B) Messages', 'C) Programs', 'D) Voice calls'], answer: 'B', category: 'BBS' },
  // Computers
  { question: 'What does CPU stand for?', options: ['A) Central Processing Unit', 'B) Computer Personal Unit', 'C) Central Program Utility', 'D) Core Processing Unit'], answer: 'A', category: 'Computers' },
  { question: 'In what year was the IBM PC introduced?', options: ['A) 1979', 'B) 1981', 'C) 1983', 'D) 1985'], answer: 'B', category: 'Computers' },
  { question: 'Who is considered the father of the World Wide Web?', options: ['A) Vint Cerf', 'B) Marc Andreessen', 'C) Tim Berners-Lee', 'D) Robert Cailliau'], answer: 'C', category: 'Computers' },
  { question: 'What programming language was created by Dennis Ritchie?', options: ['A) BASIC', 'B) Pascal', 'C) C', 'D) Fortran'], answer: 'C', category: 'Computers' },
  { question: 'How many bits are in a byte?', options: ['A) 4', 'B) 8', 'C) 16', 'D) 32'], answer: 'B', category: 'Computers' },
  { question: 'What does RAM stand for?', options: ['A) Read Access Memory', 'B) Random Active Module', 'C) Random Access Memory', 'D) Rapid Access Memory'], answer: 'C', category: 'Computers' },
  { question: 'What operating system kernel was created by Linus Torvalds in 1991?', options: ['A) BSD', 'B) Minix', 'C) Linux', 'D) GNU'], answer: 'C', category: 'Computers' },
  // Science
  { question: 'What is the chemical symbol for gold?', options: ['A) Go', 'B) Gd', 'C) Au', 'D) Ag'], answer: 'C', category: 'Science' },
  { question: 'What planet is known as the Red Planet?', options: ['A) Venus', 'B) Jupiter', 'C) Mars', 'D) Saturn'], answer: 'C', category: 'Science' },
  { question: 'What is the speed of light in km/s (approx)?', options: ['A) 150,000', 'B) 300,000', 'C) 500,000', 'D) 1,000,000'], answer: 'B', category: 'Science' },
  { question: 'What element has the atomic number 1?', options: ['A) Helium', 'B) Oxygen', 'C) Carbon', 'D) Hydrogen'], answer: 'D', category: 'Science' },
  { question: 'How many planets are in our solar system?', options: ['A) 7', 'B) 8', 'C) 9', 'D) 10'], answer: 'B', category: 'Science' },
  { question: 'What is the hardest natural substance on Earth?', options: ['A) Quartz', 'B) Topaz', 'C) Diamond', 'D) Corundum'], answer: 'C', category: 'Science' },
  // History
  { question: 'In what year did World War II end?', options: ['A) 1943', 'B) 1944', 'C) 1945', 'D) 1946'], answer: 'C', category: 'History' },
  { question: 'Who was the first person to walk on the Moon?', options: ['A) Buzz Aldrin', 'B) Yuri Gagarin', 'C) John Glenn', 'D) Neil Armstrong'], answer: 'D', category: 'History' },
  { question: 'What ancient civilization built the pyramids of Giza?', options: ['A) Romans', 'B) Greeks', 'C) Egyptians', 'D) Persians'], answer: 'C', category: 'History' },
  { question: 'The Magna Carta was signed in what year?', options: ['A) 1066', 'B) 1215', 'C) 1492', 'D) 1776'], answer: 'B', category: 'History' },
  { question: 'Who invented the printing press?', options: ['A) Leonardo da Vinci', 'B) Johannes Gutenberg', 'C) Benjamin Franklin', 'D) Thomas Edison'], answer: 'B', category: 'History' },
  // Pop Culture
  { question: 'What is the name of the AI in 2001: A Space Odyssey?', options: ['A) WOPR', 'B) Skynet', 'C) HAL 9000', 'D) GLaDOS'], answer: 'C', category: 'Pop Culture' },
  { question: 'In The Matrix, what color pill does Neo take?', options: ['A) Blue', 'B) Red', 'C) Green', 'D) White'], answer: 'B', category: 'Pop Culture' },
  { question: 'What year was the movie WarGames released?', options: ['A) 1981', 'B) 1983', 'C) 1985', 'D) 1987'], answer: 'B', category: 'Pop Culture' },
  { question: 'What classic video game features a character eating dots in a maze?', options: ['A) Space Invaders', 'B) Donkey Kong', 'C) Pac-Man', 'D) Asteroids'], answer: 'C', category: 'Pop Culture' },
  { question: 'What fictional hacker group appears in the TV show Mr. Robot?', options: ['A) Anonymous', 'B) fsociety', 'C) LulzSec', 'D) Hacktivist'], answer: 'B', category: 'Pop Culture' },
  { question: 'Who played Neo in The Matrix?', options: ['A) Brad Pitt', 'B) Tom Cruise', 'C) Keanu Reeves', 'D) Will Smith'], answer: 'C', category: 'Pop Culture' },
  { question: 'In Tron, what is the name of the main program?', options: ['A) Sark', 'B) CLU', 'C) Tron', 'D) MCP'], answer: 'C', category: 'Pop Culture' },
];

// ─── Hangman Words ─────────────────────────────────────────────────────────────

const HANGMAN_WORDS = [
  'MODEM', 'TELNET', 'BINARY', 'PACKET', 'BUFFER', 'KERNEL', 'ROUTER',
  'SERVER', 'CLIENT', 'SOCKET', 'THREAD', 'CURSOR', 'MATRIX', 'CIPHER',
  'SCRIPT', 'MODULE', 'SYNTAX', 'OBJECT', 'STRING', 'STRUCT', 'BRANCH',
  'COMMIT', 'DEPLOY', 'DOCKER', 'PYTHON', 'GITHUB', 'COOKIE', 'BACKUP',
  'BITMAP', 'DOMAIN', 'DRIVER', 'EDITOR', 'FLOPPY', 'HEADER', 'INLINE',
  'LAMBDA', 'MEMORY', 'NESTED', 'OUTPUT', 'PARSER', 'RENDER', 'TOGGLE',
  'UPLOAD', 'WIDGET', 'EXPORT', 'FORMAT', 'IMPORT', 'PROMPT', 'RETURN',
  'STATIC', 'SYSTEM',
];

// ─── Hangman ASCII Art Stages ──────────────────────────────────────────────────

const HANGMAN_STAGES = [
  // 0 wrong guesses
  [
    '  ┌───┐ ',
    '  │   │ ',
    '  │     ',
    '  │     ',
    '  │     ',
    '  ═══   ',
  ],
  // 1 wrong - head
  [
    '  ┌───┐ ',
    '  │   │ ',
    '  │   O ',
    '  │     ',
    '  │     ',
    '  ═══   ',
  ],
  // 2 wrong - body
  [
    '  ┌───┐ ',
    '  │   │ ',
    '  │   O ',
    '  │   | ',
    '  │     ',
    '  ═══   ',
  ],
  // 3 wrong - left arm
  [
    '  ┌───┐ ',
    '  │   │ ',
    '  │   O ',
    '  │  /| ',
    '  │     ',
    '  ═══   ',
  ],
  // 4 wrong - right arm
  [
    '  ┌───┐ ',
    '  │   │ ',
    '  │   O ',
    '  │  /|\\',
    '  │     ',
    '  ═══   ',
  ],
  // 5 wrong - left leg
  [
    '  ┌───┐ ',
    '  │   │ ',
    '  │   O ',
    '  │  /|\\',
    '  │  /  ',
    '  ═══   ',
  ],
  // 6 wrong - right leg (dead)
  [
    '  ┌───┐ ',
    '  │   │ ',
    '  │   O ',
    '  │  /|\\',
    '  │  / \\',
    '  ═══   ',
  ],
];

// ─── GameService Class ─────────────────────────────────────────────────────────

export class GameService {
  constructor(connection) {
    this.connection = connection;
    this.screen = connection.screen;
    this.user = connection.user;
  }

  /**
   * Show the built-in games menu.
   */
  async show() {
    while (true) {
      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('  Built-in Games', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(27), 'cyan', null, true) + '\r\n\r\n');

      const items = [
        { key: '1', label: 'Trivia Challenge' },
        { key: '2', label: 'Hangman' },
        { key: '3', label: 'Number Guesser' },
        { key: 'T', label: 'Top 10 Scores' },
        { key: 'Q', label: 'Quit' },
      ];

      for (const item of items) {
        this.connection.write(
          colorText(`  [`, 'white') +
          colorText(item.key, 'cyan', null, true) +
          colorText(`] `, 'white') +
          colorText(item.label, 'white', null, true) +
          '\r\n'
        );
      }

      this.connection.write('\r\n');
      const choice = await this.connection.getInput('  Your choice: ');
      const upper = choice.toUpperCase();

      if (upper === 'Q') return;

      switch (upper) {
        case '1':
          await this.playTrivia();
          break;
        case '2':
          await this.playHangman();
          break;
        case '3':
          await this.playNumberGuesser();
          break;
        case 'T':
          await this.showLeaderboards();
          break;
      }
    }
  }

  // ─── Trivia Challenge ──────────────────────────────────────────────────────

  async playTrivia() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  ╔══════════════════════════════════════╗', 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('  ║', 'cyan', null, true) + colorText('       TRIVIA CHALLENGE              ', 'yellow', null, true) + colorText('║', 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('  ╚══════════════════════════════════════╝', 'cyan', null, true) + '\r\n\r\n');
    this.connection.write(colorText('  10 questions, 10 points each.', 'white') + '\r\n');
    this.connection.write(colorText('  Bonus points for answer streaks!', 'green', null, true) + '\r\n\r\n');
    this.connection.write(colorText('  Press any key to start...', 'white'));
    await this.connection.getChar();

    // Pick 10 random questions
    const questions = this.shuffleArray([...TRIVIA_QUESTIONS]).slice(0, 10);
    let score = 0;
    let streak = 0;

    for (let i = 0; i < questions.length; i++) {
      const q = questions[i];
      this.screen.clear();
      this.connection.write('\r\n');

      // Header
      this.connection.write(
        colorText(`  Question ${i + 1}/10`, 'yellow', null, true) +
        colorText(`  |  Score: ${score}`, 'green', null, true) +
        colorText(`  |  Streak: ${streak}`, 'cyan', null, true) +
        '\r\n'
      );
      this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(50), 'cyan') + '\r\n');
      this.connection.write(colorText(`  Category: ${q.category}`, 'magenta', null, true) + '\r\n\r\n');

      // Question
      this.connection.write(colorText(`  ${q.question}`, 'white', null, true) + '\r\n\r\n');

      // Options
      for (const opt of q.options) {
        this.connection.write(colorText(`    ${opt}`, 'white') + '\r\n');
      }

      this.connection.write('\r\n');
      let answer = '';
      while (!['A', 'B', 'C', 'D'].includes(answer)) {
        answer = (await this.connection.getInput('  Your answer (A/B/C/D): ')).toUpperCase();
      }

      if (answer === q.answer) {
        streak++;
        let points = 10;
        let bonusMsg = '';
        if (streak >= 3) {
          const bonus = streak * 2;
          points += bonus;
          bonusMsg = colorText(` (+${bonus} streak bonus!)`, 'magenta', null, true);
        }
        score += points;
        this.connection.write('\r\n');
        this.connection.write(colorText('  CORRECT!', 'green', null, true) + bonusMsg + '\r\n');
      } else {
        streak = 0;
        this.connection.write('\r\n');
        this.connection.write(colorText(`  WRONG! The answer was ${q.answer}.`, 'red', null, true) + '\r\n');
      }

      this.connection.write(colorText('  Press any key for next question...', 'white'));
      await this.connection.getChar();
    }

    // Final score
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  ╔══════════════════════════════════════╗', 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('  ║', 'cyan', null, true) + colorText('         GAME OVER!                  ', 'yellow', null, true) + colorText('║', 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('  ╚══════════════════════════════════════╝', 'cyan', null, true) + '\r\n\r\n');
    this.connection.write(colorText(`  Final Score: ${score} points`, 'green', null, true) + '\r\n\r\n');

    this.saveScore('Trivia Challenge', score);

    this.connection.write(colorText('  Score saved! Press any key to continue...', 'white'));
    await this.connection.getChar();
  }

  // ─── Hangman ───────────────────────────────────────────────────────────────

  async playHangman() {
    const word = HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)];
    const guessed = new Set();
    let wrongGuesses = 0;
    const maxWrong = 6;

    while (wrongGuesses < maxWrong) {
      this.screen.clear();
      this.connection.write('\r\n');
      this.connection.write(colorText('  HANGMAN', 'yellow', null, true) + '\r\n');
      this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(30), 'cyan') + '\r\n\r\n');

      // Draw hangman
      const stage = HANGMAN_STAGES[wrongGuesses];
      for (const line of stage) {
        this.connection.write(colorText(`  ${line}`, 'white', null, true) + '\r\n');
      }
      this.connection.write('\r\n');

      // Show the word with blanks
      let display = '';
      let allRevealed = true;
      for (const ch of word) {
        if (guessed.has(ch)) {
          display += colorText(ch, 'green', null, true) + ' ';
        } else {
          display += colorText('_', 'white', null, true) + ' ';
          allRevealed = false;
        }
      }
      this.connection.write(`  ${display}` + '\r\n\r\n');

      // Check win
      if (allRevealed) {
        const score = Math.max(0, word.length * 10 - wrongGuesses * 5);
        this.connection.write(colorText('  YOU WIN!', 'green', null, true) + '\r\n');
        this.connection.write(colorText(`  The word was: ${word}`, 'cyan', null, true) + '\r\n');
        this.connection.write(colorText(`  Score: ${score} points`, 'yellow', null, true) + '\r\n\r\n');
        this.saveScore('Hangman', score, `Word: ${word}`);
        this.connection.write(colorText('  Score saved! Press any key to continue...', 'white'));
        await this.connection.getChar();
        return;
      }

      // Show guessed letters
      const wrongLetters = [...guessed].filter(ch => !word.includes(ch));
      if (wrongLetters.length > 0) {
        this.connection.write(colorText(`  Wrong: ${wrongLetters.join(' ')}`, 'red') + '\r\n');
      }
      this.connection.write(colorText(`  Guesses remaining: ${maxWrong - wrongGuesses}`, 'yellow') + '\r\n\r\n');

      // Get guess
      let guess = '';
      while (!guess) {
        const input = (await this.connection.getInput('  Guess a letter: ')).toUpperCase();
        if (input.length === 1 && /[A-Z]/.test(input)) {
          if (guessed.has(input)) {
            this.connection.write(colorText('  Already guessed! Try again.', 'yellow') + '\r\n');
          } else {
            guess = input;
          }
        }
      }

      guessed.add(guess);
      if (!word.includes(guess)) {
        wrongGuesses++;
      }
    }

    // Lost
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  HANGMAN', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(30), 'cyan') + '\r\n\r\n');

    const stage = HANGMAN_STAGES[maxWrong];
    for (const line of stage) {
      this.connection.write(colorText(`  ${line}`, 'red', null, true) + '\r\n');
    }
    this.connection.write('\r\n');
    this.connection.write(colorText('  GAME OVER!', 'red', null, true) + '\r\n');
    this.connection.write(colorText(`  The word was: ${word}`, 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('  Score: 0 points', 'yellow') + '\r\n\r\n');

    this.saveScore('Hangman', 0, `Word: ${word}`);

    this.connection.write(colorText('  Press any key to continue...', 'white'));
    await this.connection.getChar();
  }

  // ─── Number Guesser ────────────────────────────────────────────────────────

  async playNumberGuesser() {
    const target = Math.floor(Math.random() * 100) + 1;
    const maxGuesses = 7;

    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  ╔══════════════════════════════════════╗', 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('  ║', 'cyan', null, true) + colorText('         NUMBER GUESSER              ', 'yellow', null, true) + colorText('║', 'cyan', null, true) + '\r\n');
    this.connection.write(colorText('  ╚══════════════════════════════════════╝', 'cyan', null, true) + '\r\n\r\n');
    this.connection.write(colorText('  I\'m thinking of a number between 1 and 100.', 'white') + '\r\n');
    this.connection.write(colorText(`  You have ${maxGuesses} guesses. Good luck!`, 'green', null, true) + '\r\n\r\n');

    for (let attempt = 1; attempt <= maxGuesses; attempt++) {
      const remaining = maxGuesses - attempt + 1;
      this.connection.write(
        colorText(`  Guess ${attempt}/${maxGuesses}`, 'yellow', null, true) +
        colorText(` (${remaining} remaining): `, 'white')
      );

      let guess = NaN;
      while (isNaN(guess) || guess < 1 || guess > 100) {
        const input = await this.connection.getInput('');
        guess = parseInt(input, 10);
        if (isNaN(guess) || guess < 1 || guess > 100) {
          this.connection.write(colorText('  Enter a number between 1 and 100: ', 'yellow'));
        }
      }

      if (guess === target) {
        const score = (maxGuesses - attempt + 1) * 15;
        this.connection.write('\r\n');
        this.connection.write(colorText('  *** CORRECT! ***', 'green', null, true) + '\r\n');
        this.connection.write(colorText(`  You got it in ${attempt} guess${attempt > 1 ? 'es' : ''}!`, 'cyan', null, true) + '\r\n');
        this.connection.write(colorText(`  Score: ${score} points`, 'yellow', null, true) + '\r\n\r\n');

        this.saveScore('Number Guesser', score, `Guessed ${target} in ${attempt}`);

        this.connection.write(colorText('  Score saved! Press any key to continue...', 'white'));
        await this.connection.getChar();
        return;
      }

      if (guess < target) {
        this.connection.write(colorText('  Too low!', 'red', null, true) + '\r\n\r\n');
      } else {
        this.connection.write(colorText('  Too high!', 'blue', null, true) + '\r\n\r\n');
      }
    }

    // Out of guesses
    this.connection.write(colorText(`  Out of guesses! The number was ${target}.`, 'red', null, true) + '\r\n');
    this.connection.write(colorText('  Score: 0 points', 'yellow') + '\r\n\r\n');

    this.saveScore('Number Guesser', 0, `Target was ${target}`);

    this.connection.write(colorText('  Press any key to continue...', 'white'));
    await this.connection.getChar();
  }

  // ─── Leaderboards ─────────────────────────────────────────────────────────

  async showLeaderboards() {
    this.screen.clear();
    this.connection.write('\r\n');
    this.connection.write(colorText('  Top 10 Scores', 'yellow', null, true) + '\r\n');
    this.connection.write(colorText('  ' + BOX.D_HORIZONTAL.repeat(41), 'cyan', null, true) + '\r\n');

    const games = ['Trivia Challenge', 'Hangman', 'Number Guesser'];
    const db = getDatabase();
    const showNetwork = isNetworkConfigured();

    for (const gameName of games) {
      this.connection.write('\r\n');
      this.connection.write(colorText(`  ${gameName} - Local Top 10`, 'green', null, true) + '\r\n');
      this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(41), 'cyan') + '\r\n');

      const scores = db.prepare(`
        SELECT username, score, played_at
        FROM game_scores
        WHERE game_name = ?
        ORDER BY score DESC
        LIMIT 10
      `).all(gameName);

      if (scores.length === 0) {
        this.connection.write(colorText('  No scores yet.', 'white') + '\r\n');
      } else {
        // Header
        this.connection.write(
          colorText('  ' + padText('Rank', 6) + padText('Player', 20) + padText('Score', 8) + 'Date', 'white', null, true) + '\r\n'
        );

        for (let i = 0; i < scores.length; i++) {
          const s = scores[i];
          const dateStr = s.played_at
            ? new Date(s.played_at + 'Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : '';
          const rankColor = i === 0 ? 'yellow' : i === 1 ? 'white' : i === 2 ? 'cyan' : 'white';
          this.connection.write(
            colorText('  ' + padText(`${i + 1}`, 6), rankColor, null, i < 3) +
            colorText(padText(s.username, 20), 'green') +
            colorText(padText(`${s.score}`, 8), 'yellow', null, true) +
            colorText(dateStr, 'white') +
            '\r\n'
          );
        }
      }

      // Show network scores if inter-BBS is configured
      if (showNetwork) {
        const netScores = getNetworkScores(gameName, 10);
        this.connection.write('\r\n');
        this.connection.write(colorText(`  ${gameName} - Network Top 10`, 'magenta', null, true) + '\r\n');
        this.connection.write(colorText('  ' + BOX.HORIZONTAL.repeat(50), 'cyan') + '\r\n');

        if (netScores.length === 0) {
          this.connection.write(colorText('  No network scores yet.', 'white') + '\r\n');
        } else {
          this.connection.write(
            colorText('  ' + padText('Rank', 6) + padText('Player', 22) + padText('BBS', 16) + padText('Score', 8), 'white', null, true) + '\r\n'
          );

          for (let i = 0; i < netScores.length; i++) {
            const s = netScores[i];
            const rankColor = i === 0 ? 'yellow' : i === 1 ? 'white' : i === 2 ? 'cyan' : 'white';
            this.connection.write(
              colorText('  ' + padText(`${i + 1}`, 6), rankColor, null, i < 3) +
              colorText(padText(s.username, 22), 'green') +
              colorText(padText(s.origin_bbs, 16), 'magenta') +
              colorText(padText(`${s.score}`, 8), 'yellow', null, true) +
              '\r\n'
            );
          }
        }
      }
    }

    this.connection.write('\r\n');
    this.connection.write(colorText('  Press any key to continue...', 'white'));
    await this.connection.getChar();
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  /**
   * Save a game score to the database.
   */
  saveScore(gameName, score, details = null) {
    const db = getDatabase();
    db.prepare(`
      INSERT INTO game_scores (game_name, user_id, username, score, details)
      VALUES (?, ?, ?, ?, ?)
    `).run(gameName, this.user.id, this.user.username, score, details);

    // Queue score for inter-BBS sync if networking is configured
    queueScoreForSync(gameName, this.user.username, score);
  }

  /**
   * Fisher-Yates shuffle.
   */
  shuffleArray(arr) {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  }
}

export default GameService;
