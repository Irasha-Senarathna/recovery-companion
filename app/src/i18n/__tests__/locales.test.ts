import en from '../locales/en.json';
import si from '../locales/si.json';
import ta from '../locales/ta.json';

type Tree = { [key: string]: string | Tree };

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

const locales = { en, si, ta } as Record<string, Tree>;
const enKeys = Object.keys(flatten(en)).sort();

describe('locale parity', () => {
  it.each(['si', 'ta'])('%s has exactly the same keys as en', (lang) => {
    expect(Object.keys(flatten(locales[lang])).sort()).toEqual(enKeys);
  });

  it.each(Object.keys(locales))('%s has no empty strings', (lang) => {
    const empty = Object.entries(flatten(locales[lang])).filter(([, v]) => v.trim() === '');
    expect(empty).toEqual([]);
  });

  it.each(['si', 'ta'])('%s is marked needs_review until a native speaker checks it', (lang) => {
    expect((locales[lang]._meta as Tree).status).toBe('needs_review');
  });
});

// Safety rule 5: no shame language. Kept in English for now; si/ta terms are
// added once a native speaker has reviewed the translations.
const SHAME_PATTERNS = [
  /\bfail(ed|ure|ures|ing)?\b/i,
  /\b(clean|dirty)\b/i,
  /\baddicts?\b/i,
  /\babusers?\b/i,
  /\bjunkies?\b/i,
  /\bstart(ing)? over\b/i,
  /\bback to (day )?(zero|0|one|1)\b/i,
  /\bweak(ness)?\b/i,
  /\bshameful\b/i,
];

describe('shame language (safety rule 5)', () => {
  const strings = Object.entries(flatten(en));

  it.each(SHAME_PATTERNS.map((p) => [p.source, p]))('no en string matches %s', (_, pattern) => {
    const hits = strings.filter(([, text]) => (pattern as RegExp).test(text));
    expect(hits).toEqual([]);
  });
});
