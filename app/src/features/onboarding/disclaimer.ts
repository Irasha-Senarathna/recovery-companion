import text from '../../../../content/disclaimer.md';
import { parseMarkdown, type MarkdownBlock } from '../../utils/markdown';

export type DisclaimerBlock = MarkdownBlock;

/** The user-verified Markdown disclaimer as plain blocks. */
export const parseDisclaimer = parseMarkdown;

export function loadDisclaimer(): DisclaimerBlock[] {
  return parseDisclaimer(text);
}
