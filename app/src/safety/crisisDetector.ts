import { CRISIS_TERMS } from './crisisTerms';

export { CRISIS_TERMS };

/** Lower-case, unify apostrophes and dashes, drop zero-width joiners, collapse spaces. */
function normalise(text: string): string {
  return text
    .normalize('NFC')
    .toLowerCase()
    .replace(/[‘’ʼ`]/g, "'")
    .replace(/[‐-―]/g, '-')
    // Zero-width and soft-hyphen characters can hide a word from the check.
    .replace(/[\u200b\u200c\u200d\u00ad\u2060\ufeff]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

// Mirrors coach/app/text.py, so the phone and the coach service see through the same tricks.
const LEET: Record<string, string> = {
  '0': 'o',
  '1': 'i',
  '3': 'e',
  '4': 'a',
  '5': 's',
  '7': 't',
  '@': 'a',
  $: 's',
};
// Single letters split by spaces or marks: "d o s e", "d.o.s.e", "d-o-s-e".
// JS \w is ASCII-only (Python's is Unicode), so this may join a little more text
// than the coach does. It only affects the extra copy that is checked, never the original.
const SPACED = /(?<![\w'@$])(?:[a-z][\s.\-_*]){2,}[a-z](?![\w@$])/g;
const MIXED = /[a-z@$]*[0-9@$][a-z0-9@$]*/g;

function unleet(word: string): string {
  const letters = [...word].filter((ch) => /[a-z]/.test(ch)).length;
  return letters >= 2 ? word.replace(/[013457@$]/g, (ch) => LEET[ch]) : word;
}

/** Undo common spelling tricks ("d0se", "x@nax", "d o s e") on normalised text. */
export function deobfuscate(text: string): string {
  return text
    .replace(SPACED, (match) => match.replace(/[\s.\-_*]/g, ''))
    .replace(MIXED, (match) => unleet(match));
}

const LATIN_PATTERN = new RegExp(
  `\\b(${[...CRISIS_TERMS.en.patterns, ...CRISIS_TERMS.romanised.patterns].join('|')})\\b`,
);
const SCRIPT_TERMS = [...CRISIS_TERMS.si.terms, ...CRISIS_TERMS.ta.terms].map(normalise);

/** Safety rule 4: true if the text contains crisis words in any app language. */
export function detectCrisis(text: string): boolean {
  const clean = normalise(text);
  if (!clean) return false;
  return [clean, deobfuscate(clean)].some(
    (form) => LATIN_PATTERN.test(form) || SCRIPT_TERMS.some((term) => form.includes(term)),
  );
}
