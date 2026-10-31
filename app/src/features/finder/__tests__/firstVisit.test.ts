import { LANGUAGES } from '../../../i18n';
import { loadFirstVisit } from '../firstVisit';

describe('loadFirstVisit', () => {
  it.each(LANGUAGES)('has a guide in %s, with a title, sections and steps', (language) => {
    const guide = loadFirstVisit(language);
    expect(guide.title.trim()).not.toBe('');
    expect(guide.blocks.filter((b) => b.kind === 'heading').length).toBeGreaterThanOrEqual(3);
    expect(guide.blocks.filter((b) => b.kind === 'bullet').length).toBeGreaterThanOrEqual(5);
  });

  it('gives each language its own text', () => {
    const titles = LANGUAGES.map((language) => loadFirstVisit(language).title);
    expect(new Set(titles).size).toBe(LANGUAGES.length);
  });

  it('keeps the same shape in every language', () => {
    const shape = (language: (typeof LANGUAGES)[number]) =>
      loadFirstVisit(language).blocks.map((b) => b.kind);
    expect(shape('si')).toEqual(shape('en'));
    expect(shape('ta')).toEqual(shape('en'));
  });

  it('points to staff for anything about health, and to help if unwell', () => {
    const text = loadFirstVisit('en')
      .blocks.map((b) => b.text)
      .join(' ');
    expect(text).toMatch(/tell the staff/i);
    expect(text).toMatch(/get help now/i);
  });
});
