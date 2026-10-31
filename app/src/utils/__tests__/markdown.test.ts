import { parseMarkdown } from '../markdown';

describe('parseMarkdown', () => {
  it('drops comments, keeps headings and paragraphs, strips emphasis', () => {
    const md = '<!-- note\nfor dev -->\n# About\n\nIt does **not**\nreplace care.\n\nLast line.';
    expect(parseMarkdown(md)).toEqual([
      { kind: 'heading', text: 'About' },
      { kind: 'paragraph', text: 'It does not replace care.' },
      { kind: 'paragraph', text: 'Last line.' },
    ]);
  });

  it('turns "- " lines into one bullet each', () => {
    const md = '## Before you go\n\n- Call ahead.\n- Bring a\n  friend.\n* Ask _anything_.';
    expect(parseMarkdown(md)).toEqual([
      { kind: 'heading', text: 'Before you go' },
      { kind: 'bullet', text: 'Call ahead.' },
      { kind: 'bullet', text: 'Bring a friend.' },
      { kind: 'bullet', text: 'Ask anything.' },
    ]);
  });
});
