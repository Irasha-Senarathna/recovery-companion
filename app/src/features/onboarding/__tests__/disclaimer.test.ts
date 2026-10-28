import { loadDisclaimer, parseDisclaimer } from '../disclaimer';

describe('parseDisclaimer', () => {
  it('drops comments, keeps headings and paragraphs, strips emphasis', () => {
    const md = '<!-- note\nfor dev -->\n# About\n\nIt does **not**\nreplace care.\n\nLast line.';
    expect(parseDisclaimer(md)).toEqual([
      { kind: 'heading', text: 'About' },
      { kind: 'paragraph', text: 'It does not replace care.' },
      { kind: 'paragraph', text: 'Last line.' },
    ]);
  });

  it('reads content/disclaimer.md', () => {
    expect(loadDisclaimer().length).toBeGreaterThan(0);
  });
});
