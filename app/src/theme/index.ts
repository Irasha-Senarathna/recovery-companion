import { useColorScheme } from 'react-native';

/**
 * "Dawn lagoon": misty sage, deep teal and a warm peach glow. Calm, never
 * clinical. Body text keeps at least 4.5:1 contrast on its background in
 * both modes; the help colour stays a clear, distinct red.
 */
export type Theme = {
  background: string;
  surface: string;
  /** Tinted cards and chips that sit on the background. */
  surfaceSoft: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  /** Warm highlight for gentle emphasis (progress, reasons). */
  accent: string;
  onAccent: string;
  help: string;
  onHelp: string;
  border: string;
  banner: string;
  onBanner: string;
  /** Screen background gradient, top to bottom. */
  gradient: readonly [string, string];
  /** The SOS button glow, inner to outer. */
  sos: readonly [string, string];
  onSos: string;
  /** Translucent layers for waves and illustrations. */
  wave: readonly [string, string, string];
  /** The sun in the illustrations (a soft moon in dark mode). */
  sun: string;
};

export const lightTheme: Theme = {
  background: '#F3F6F4',
  surface: '#FFFFFF',
  surfaceSoft: '#E4EFEB',
  text: '#1E2A28',
  textMuted: '#4A5855',
  primary: '#2E6B67',
  onPrimary: '#FFFFFF',
  accent: '#F4C9A8',
  onAccent: '#3A2414',
  help: '#B3261E',
  onHelp: '#FFFFFF',
  border: '#CFDAD6',
  banner: '#FFE7A3',
  onBanner: '#3D2E00',
  gradient: ['#DDEFEA', '#F8EADF'],
  sos: ['#3F8C85', '#2E6B67'],
  onSos: '#FFFFFF',
  wave: ['rgba(46,107,103,0.18)', 'rgba(95,163,156,0.22)', 'rgba(244,201,168,0.35)'],
  sun: '#F4C9A8',
};

export const darkTheme: Theme = {
  background: '#0F1A1A',
  surface: '#172524',
  surfaceSoft: '#1E3230',
  text: '#E6EFEC',
  textMuted: '#B3C3BF',
  primary: '#8FD3CB',
  onPrimary: '#06302C',
  accent: '#3E3446',
  onAccent: '#F3E6F0',
  help: '#F2B8B5',
  onHelp: '#601410',
  border: '#2E4341',
  banner: '#5C4A00',
  onBanner: '#FFE7A3',
  gradient: ['#102624', '#1E1B26'],
  sos: ['#3F8C85', '#1F4A47'],
  onSos: '#FFFFFF',
  wave: ['rgba(143,211,203,0.14)', 'rgba(95,163,156,0.18)', 'rgba(232,226,208,0.08)'],
  sun: '#E8E2D0',
};

/** Minimum tap target in dp (accessibility). */
export const MIN_TAP = 48;

/** Soft, rounded shapes everywhere. */
export const RADIUS = { card: 24, button: 18, pill: 999 } as const;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
