export type MarkdownBlock = { kind: 'heading' | 'paragraph' | 'bullet'; text: string };

const BULLET = /^\s*[-*]\s+/;

const plain = (text: string) =>
  text
    .replace(/\s*\n\s*/g, ' ')
    .trim()
    .replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2');

/** A block of "- " lines becomes one bullet per item (wrapped lines join their item). */
function splitBullets(block: string): string[] {
  return block.split(/\n(?=\s*[-*]\s)/).map((item) => item.replace(BULLET, ''));
}

/**
 * Turns developer-written Markdown content into plain blocks: comments are
 * dropped, `#` lines become headings, `-` lists become bullets, and
 * bold/italic markers are removed. Nothing is rendered as HTML.
 */
export function parseMarkdown(markdown: string): MarkdownBlock[] {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\n\s*\n/)
    .filter((block) => block.trim() !== '')
    .flatMap((block): MarkdownBlock[] => {
      if (BULLET.test(block)) {
        return splitBullets(block.trim()).map((item) => ({ kind: 'bullet', text: plain(item) }));
      }
      const text = plain(block);
      return text.startsWith('#')
        ? [{ kind: 'heading', text: text.replace(/^#+\s*/, '') }]
        : [{ kind: 'paragraph', text }];
    });
}
