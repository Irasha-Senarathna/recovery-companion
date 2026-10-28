import { CRISIS_TERMS } from './crisisTerms';

export { CRISIS_TERMS };

/** Lower-case, unify apostrophes and dashes, drop zero-width joiners, collapse spaces. */
function normalise(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[‐-―]/g, '-')
    .replace(/[‌‍]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

const LATIN_PATTERN = new RegExp(
  `\\b(${[...CRISIS_TERMS.en.patterns, ...CRISIS_TERMS.romanised.patterns].join('|')})\\b`,
);
const SCRIPT_TERMS = [...CRISIS_TERMS.si.terms, ...CRISIS_TERMS.ta.terms].map(normalise);

/** Safety rule 4: true if the text contains crisis words in any app language. */
export function detectCrisis(text: string): boolean {
  const clean = normalise(text);
  if (!clean) return false;
  return LATIN_PATTERN.test(clean) || SCRIPT_TERMS.some((term) => clean.includes(term));
}
