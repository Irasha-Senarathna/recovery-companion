import { listSourceFiles, readSource } from '../test-utils/sourceFiles';

/**
 * Safety rule 3: helpline numbers come only from content/helplines.json.
 * Flags any string literal with a run of 3+ digits (a short code like 1990,
 * or a number inside a longer sentence), literal `tel:` links, and any 3+
 * digit run in UI text. Font weights, colours and lines marked
 * `not-a-phone-number` (with a reason) are skipped.
 */
const STRING_LITERAL = /(['"`])(?:\\.|(?!\1)[^\\\n])*\1/g;
const NUMBER_IN_TEXT = /\+?\d[\d\s()-]*\d{2}/;
const TEL_LITERAL = /tel:\s*\+?\d/;
const DIGIT_RUN = /\d{3,}/;

const FONT_WEIGHT = /fontWeight:\s*(['"])\d00\1/g;
const HEX_COLOUR = /(['"])#[0-9a-f]{3,8}\1/gi;
const RGBA_COLOUR = /(['"])rgba?\([\d.,\s]+\)\1/g;
const MARKED_LINE = /^.*not-a-phone-number.*$/gm;
// SVG drawing geometry (paths, viewBox, circles) and percentages are not phone numbers.
const SVG_GEOMETRY = /\b(d|viewBox|cx|cy|r|x|y|x1|x2|y1|y2|offset)="[^"]*"/g;
const PERCENT = /(['"])\d+(\.\d+)?%\1/g;

function phoneLiterals(source: string): string[] {
  const cleaned = source
    .replace(MARKED_LINE, '')
    .replace(FONT_WEIGHT, '')
    .replace(HEX_COLOUR, '')
    .replace(RGBA_COLOUR, '')
    .replace(SVG_GEOMETRY, '')
    .replace(PERCENT, '');
  return [...cleaned.matchAll(STRING_LITERAL)]
    .map((m) => m[0])
    .filter((literal) => NUMBER_IN_TEXT.test(literal) && /\d{3,}|\d[\s-]\d/.test(literal))
    .filter((literal) => (literal.match(/\d/g) ?? []).length >= 3);
}

describe('no hard-coded helpline numbers (safety rule 3)', () => {
  const codeFiles = listSourceFiles(['.ts', '.tsx']);
  const localeFiles = listSourceFiles(['.json']).filter((f) => f.includes('locales'));

  it('has files to check', () => {
    expect(codeFiles.length).toBeGreaterThan(10);
    expect(localeFiles).toHaveLength(3);
  });

  it.each(codeFiles)('%s has no phone-number literals', (file) => {
    const source = readSource(file);
    expect(phoneLiterals(source)).toEqual([]);
    expect(source).not.toMatch(TEL_LITERAL);
  });

  it.each(localeFiles)('%s has no numbers in UI text', (file) => {
    const values: string[] = [];
    JSON.parse(readSource(file), (_key, value) => {
      if (typeof value === 'string') values.push(value);
      return value;
    });
    expect(values.filter((v) => DIGIT_RUN.test(v))).toEqual([]);
  });

  it('the detector itself catches typical numbers', () => {
    expect(phoneLiterals(`const n = '1927';`)).toHaveLength(1);
    expect(phoneLiterals(`call("011 309 1394")`)).toHaveLength(1);
    expect(phoneLiterals('x = `+94 11 2868794`')).toHaveLength(1);
    expect(phoneLiterals(`const id = 'help-button';`)).toEqual([]);
    expect(phoneLiterals(`{ fontWeight: '700' }`)).toEqual([]);
    expect(phoneLiterals(`const msg = 'Call 1990 now';`)).toHaveLength(1);
    expect(phoneLiterals(`<Path d="M0 98 C 60 62, 120 64" /> width="100%"`)).toEqual([]);
    expect(phoneLiterals(`<Text label="1990" />`)).toHaveLength(1);
  });
});
