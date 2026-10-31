import { render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import HomeRoute from '../app/index';
import { SosButton } from '../features/sos/SosButton';
import { DISPLAY_TEXT_MAX_SCALE, LARGE_TEXT_SCALE } from '../theme';
import { listSourceFiles, readSource } from '../test-utils/sourceFiles';
import { fakeSession, layoutWithSession } from '../test-utils/session';

let mockFontScale = 1;
jest.mock('react-native/Libraries/Utilities/useWindowDimensions', () => ({
  __esModule: true,
  default: () => ({ width: 360, height: 760, scale: 3, fontScale: mockFontScale }),
}));

const style = (testID: string) =>
  StyleSheet.flatten(screen.getByTestId(testID).props.style) as Record<string, unknown>;

beforeEach(() => {
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => {
  mockFontScale = 1;
  jest.restoreAllMocks();
});

describe('text set to 200% in the phone settings', () => {
  it('stacks the header so the title is not squeezed by the buttons', async () => {
    mockFontScale = 2;
    await renderRouter(
      { _layout: layoutWithSession(fakeSession()), index: HomeRoute },
      { initialUrl: '/' },
    );
    expect(style('screen-header').flexDirection).toBe('column');
  });

  it('keeps the header on one row at normal size', async () => {
    await renderRouter(
      { _layout: layoutWithSession(fakeSession()), index: HomeRoute },
      { initialUrl: '/' },
    );
    expect(style('screen-header').flexDirection).toBe('row');
  });

  it('turns the round SOS button into a wide one that grows with its text', async () => {
    mockFontScale = 2;
    await render(<SosButton onPress={() => {}} />);
    const button = style('sos-button');
    expect(button.height).toBeUndefined();
    expect(button.width).toBe('100%');
  });

  it('keeps the round SOS button at normal size', async () => {
    await render(<SosButton onPress={() => {}} />);
    expect(style('sos-button').height).toBe(style('sos-button').width);
  });

  it('switches layout well before 200%', () => {
    expect(LARGE_TEXT_SCALE).toBeLessThanOrEqual(1.5);
  });
});

describe('font scaling is never turned off', () => {
  const files = listSourceFiles(['.tsx']);

  it.each(files)('%s keeps allowFontScaling on', (file) => {
    expect(readSource(file)).not.toMatch(/allowFontScaling=\{false\}/);
  });

  it.each(files)('%s only caps scaling with DISPLAY_TEXT_MAX_SCALE', (file) => {
    for (const [, value] of readSource(file).matchAll(/maxFontSizeMultiplier=\{([^}]*)\}/g)) {
      expect(value.trim()).toBe('DISPLAY_TEXT_MAX_SCALE');
    }
  });

  it('caps only text that is already bigger than body text at 200%', () => {
    // The smallest capped display text (32) still ends up larger than 17 x 2.
    expect(32 * DISPLAY_TEXT_MAX_SCALE).toBeGreaterThanOrEqual(17 * 2);
  });
});
