/**
 * Text utility functions
 */

/**
 * Word wrap text to fit terminal width
 * @param {string} text - The text to wrap
 * @param {number} width - Maximum line width (default: 78)
 * @returns {string} Wrapped text with \r\n line endings
 */
export function wordWrap(text, width = 78) {
  const lines = [];
  const paragraphs = text.split('\n');

  for (const paragraph of paragraphs) {
    if (paragraph.trim() === '') {
      lines.push('');
      continue;
    }

    const words = paragraph.split(' ');
    let currentLine = '';

    for (const word of words) {
      if ((currentLine + word).length > width) {
        if (currentLine.length > 0) {
          lines.push(currentLine.trim());
          currentLine = word + ' ';
        } else {
          // Word is longer than width, just add it
          lines.push(word);
          currentLine = '';
        }
      } else {
        currentLine += word + ' ';
      }
    }

    if (currentLine.trim().length > 0) {
      lines.push(currentLine.trim());
    }
  }

  return lines.join('\r\n');
}
