import { usePreventScreenCapture } from 'expo-screen-capture';

/**
 * Sets FLAG_SECURE on Android for the whole app: no screenshots, no screen
 * recording, and a blank preview in the app switcher. (Android only: on iOS
 * the app-switcher snapshot is not blanked.)
 */
export function useSecureScreen(): void {
  usePreventScreenCapture('recovery-companion');
}
