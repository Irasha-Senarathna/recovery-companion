import { useColorScheme } from 'react-native';

export type Theme = {
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  primary: string;
  onPrimary: string;
  help: string;
  onHelp: string;
  border: string;
  banner: string;
  onBanner: string;
};

export const lightTheme: Theme = {
  background: '#F7F7F4',
  surface: '#FFFFFF',
  text: '#1B1C1A',
  textMuted: '#4A4D48',
  primary: '#2F5D62',
  onPrimary: '#FFFFFF',
  help: '#B3261E',
  onHelp: '#FFFFFF',
  border: '#C9CCC5',
  banner: '#FFE7A3',
  onBanner: '#3D2E00',
};

export const darkTheme: Theme = {
  background: '#121412',
  surface: '#1E211E',
  text: '#E8E9E5',
  textMuted: '#B9BCB5',
  primary: '#9CD0D6',
  onPrimary: '#00363B',
  help: '#F2B8B5',
  onHelp: '#601410',
  border: '#444843',
  banner: '#5C4A00',
  onBanner: '#FFE7A3',
};

/** Minimum tap target in dp (accessibility). */
export const MIN_TAP = 48;

export function useTheme(): Theme {
  return useColorScheme() === 'dark' ? darkTheme : lightTheme;
}
