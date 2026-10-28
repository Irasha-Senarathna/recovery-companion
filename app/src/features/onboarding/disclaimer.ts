import text from '../../../../content/disclaimer.md';

export type DisclaimerBlock = { kind: 'heading' | 'paragraph'; text: string };

/**
 * Turns the user-verified Markdown disclaimer into plain blocks: comments are
 * dropped, `#` lines become headings, and bold/italic markers are removed.
 */
export function parseDisclaimer(markdown: string): DisclaimerBlock[] {
  return markdown
    .replace(/<!--[\s\S]*?-->/g, '')
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s*\n\s*/g, ' ').trim())
    .filter(Boolean)
    .map((block) => {
      const plain = block.replace(/(\*\*|__|\*|_)(.+?)\1/g, '$2');
      return plain.startsWith('#')
        ? { kind: 'heading' as const, text: plain.replace(/^#+\s*/, '') }
        : { kind: 'paragraph' as const, text: plain };
    });
}

export function loadDisclaimer(): DisclaimerBlock[] {
  return parseDisclaimer(text);
}
