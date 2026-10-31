import { contrastRatio, darkTheme, lightTheme, type Theme } from '../index';

/** WCAG 2.2: 4.5:1 for text (1.4.3), 3:1 for the outline of a control (1.4.11). */
const TEXT = 4.5;
const CONTROL = 3;

type Pair = [foreground: keyof Theme | string, background: keyof Theme | string];

const colour = (theme: Theme, token: string): string => {
  const [name, index] = token.split('.');
  const value = theme[name as keyof Theme];
  return index === undefined ? (value as string) : (value as readonly string[])[Number(index)];
};

/** Every text colour on every surface it is drawn on (gradient.N is the screen background). */
const TEXT_PAIRS: Pair[] = [
  ...['text', 'textMuted', 'primary', 'help'].flatMap((fg) =>
    ['background', 'surface', 'surfaceSoft', 'gradient.0', 'gradient.1'].map(
      (bg) => [fg, bg] as Pair,
    ),
  ),
  ['onPrimary', 'primary'],
  ['onAccent', 'accent'],
  ['text', 'accent'],
  ['onHelp', 'help'],
  ['onBanner', 'banner'],
  ['onSos', 'sos.0'],
  ['onSos', 'sos.1'],
];

/** Text inputs and switch tracks need a visible edge. */
const CONTROL_PAIRS: Pair[] = [
  ['outline', 'surface'],
  ['outline', 'background'],
  ['outline', 'surfaceSoft'],
];

describe('contrastRatio', () => {
  it('matches the WCAG reference values', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeCloseTo(21, 5);
    expect(contrastRatio('#FFFFFF', '#FFFFFF')).toBeCloseTo(1, 5);
    expect(contrastRatio('#767676', '#FFFFFF')).toBeCloseTo(4.54, 2);
  });

  it('does not depend on the order of the colours', () => {
    expect(contrastRatio('#2E6B67', '#F3F6F4')).toBe(contrastRatio('#F3F6F4', '#2E6B67'));
  });
});

describe.each([
  ['light', lightTheme],
  ['dark', darkTheme],
])('%s theme contrast', (_, theme) => {
  it.each(TEXT_PAIRS)(`%s text on %s is at least ${TEXT}:1`, (fg, bg) => {
    expect(contrastRatio(colour(theme, fg), colour(theme, bg))).toBeGreaterThanOrEqual(TEXT);
  });

  it.each(CONTROL_PAIRS)(`%s on %s is at least ${CONTROL}:1`, (fg, bg) => {
    expect(contrastRatio(colour(theme, fg), colour(theme, bg))).toBeGreaterThanOrEqual(CONTROL);
  });
});
