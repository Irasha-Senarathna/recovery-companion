import shameTerms from '../../../../content/shame_terms.json';
import en from '../locales/en.json';
import si from '../locales/si.json';
import ta from '../locales/ta.json';

type Tree = { [key: string]: string | Tree };
type Meta = { status: string; sameAsEnglish: string[]; priorityReview: string[] };

/** Flatten nested translation keys to "a.b.c" (the _meta block is skipped). */
function flatten(tree: Tree, prefix = ''): Record<string, string> {
  return Object.entries(tree).reduce<Record<string, string>>((acc, [key, value]) => {
    if (key === '_meta') return acc;
    const fullKey = prefix ? `${prefix}.${key}` : key;
    return typeof value === 'string'
      ? { ...acc, [fullKey]: value }
      : { ...acc, ...flatten(value, fullKey) };
  }, {});
}

const english = flatten(en as unknown as Tree);
const enKeys = Object.keys(english).sort();
const translations = { si, ta } as unknown as Record<string, Tree>;
const meta = (lang: string) => translations[lang]._meta as unknown as Meta;

/** The {{placeholders}} in a string, sorted. */
const placeholders = (text: string) =>
  (text.match(/{{\s*\w+\s*}}/g) ?? []).map((p) => p.replace(/\s/g, '')).sort();

describe.each(['si', 'ta'])('%s translation', (lang) => {
  const strings = flatten(translations[lang]);

  it('has exactly the same keys as en', () => {
    expect(Object.keys(strings).sort()).toEqual(enKeys);
  });

  it('has no empty strings', () => {
    expect(Object.entries(strings).filter(([, v]) => v.trim() === '')).toEqual([]);
  });

  it('is marked needs_review until a native speaker checks it', () => {
    expect(meta(lang).status).toBe('needs_review');
  });

  it('only leaves a string in English when it is listed in _meta.sameAsEnglish', () => {
    const same = Object.keys(strings).filter((key) => strings[key] === english[key]);
    expect(same.sort()).toEqual([...meta(lang).sameAsEnglish].sort());
  });

  it('lists real key prefixes for priority review', () => {
    expect(meta(lang).priorityReview.length).toBeGreaterThan(0);
    for (const prefix of meta(lang).priorityReview) {
      expect(enKeys.some((key) => key === prefix || key.startsWith(`${prefix}.`))).toBe(true);
    }
  });

  it('uses the same {{placeholders}} as en', () => {
    const mismatched = enKeys.filter((key) => {
      const theirs = placeholders(strings[key]);
      const ours = placeholders(english[key]);
      // A "one" plural form may spell the number out ("once") instead of {{count}}.
      if (key.endsWith('_one')) {
        return theirs.some((p) => !ours.includes(p)) || theirs.length < ours.length - 1;
      }
      return theirs.join() !== ours.join();
    });
    expect(mismatched).toEqual([]);
  });
});

// Safety rule 5: no shame language, in any language. si/ta lists are drafts
// (content/shame_terms.json) awaiting native-speaker review.
describe('shame language (safety rule 5)', () => {
  it.each(shameTerms.en.patterns)('no en string matches /%s/', (pattern) => {
    const regex = new RegExp(`\\b(${pattern})\\b`, 'i');
    expect(Object.entries(english).filter(([, text]) => regex.test(text))).toEqual([]);
  });

  it.each([
    ['si', shameTerms.si.terms],
    ['ta', shameTerms.ta.terms],
  ])('no %s string uses a listed shame word', (lang, terms) => {
    const strings = Object.entries(flatten(translations[lang]));
    const hits = strings.filter(([, text]) =>
      terms.some((term) => text.normalize('NFC').includes(term.normalize('NFC'))),
    );
    expect(hits).toEqual([]);
  });

  it('keeps the si/ta lists marked as drafts', () => {
    expect(shameTerms.si.status).toBe('needs_review');
    expect(shameTerms.ta.status).toBe('needs_review');
  });
});
