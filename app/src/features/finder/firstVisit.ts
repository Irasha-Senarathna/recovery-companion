import en from '../../../../content/first_visit.md';
import si from '../../../../content/first_visit.si.md';
import ta from '../../../../content/first_visit.ta.md';
import type { Language } from '../../i18n';
import { parseMarkdown, type MarkdownBlock } from '../../utils/markdown';

export type FirstVisitGuide = { title: string; blocks: MarkdownBlock[] };

const GUIDES: Record<Language, string> = { en, si, ta };

/** The guide's first heading becomes the screen title; the rest is the body. */
export function loadFirstVisit(language: Language): FirstVisitGuide {
  const [first, ...rest] = parseMarkdown(GUIDES[language] || GUIDES.en);
  return first?.kind === 'heading'
    ? { title: first.text, blocks: rest }
    : { title: '', blocks: first ? [first, ...rest] : [] };
}
