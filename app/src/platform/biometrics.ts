import { getRandomBytesAsync } from 'expo-crypto';
import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../storage/secureKeys';

export type BiometricUnlock = 'ok' | 'cancelled' | 'invalidated';

export async function canUseBiometrics(): Promise<boolean> {
  return (
    (await LocalAuthentication.hasHardwareAsync()) && (await LocalAuthentication.isEnrolledAsync())
  );
}

const tokenOptions = (prompt: string): SecureStore.SecureStoreOptions => ({
  requireAuthentication: true,
  authenticationPrompt: prompt,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
});

/**
 * Turns on biometric unlock: a scan must succeed, then a random token is
 * stored behind biometric authentication. Android invalidates that token if a
 * new fingerprint or face is enrolled, so someone who adds their own cannot
 * get in. No fallback to the device passcode, which others may know.
 */
export async function enableBiometricUnlock(prompt: string, cancelLabel: string): Promise<boolean> {
  try {
    const scan = await LocalAuthentication.authenticateAsync({
      promptMessage: prompt,
      cancelLabel,
      disableDeviceFallback: true,
      biometricsSecurityLevel: 'strong',
    });
    if (!scan.success) return false;
    const token = Array.from(await getRandomBytesAsync(16)).join('.');
    await SecureStore.setItemAsync(SECURE_KEYS.bioToken, token, tokenOptions(prompt));
    return true;
  } catch {
    return false;
  }
}

/** Reading the token needs a biometric scan; a missing token means enrolment changed. */
export async function unlockWithBiometricToken(prompt: string): Promise<BiometricUnlock> {
  try {
    const token = await SecureStore.getItemAsync(SECURE_KEYS.bioToken, tokenOptions(prompt));
    return token ? 'ok' : 'invalidated';
  } catch {
    return 'cancelled';
  }
}

export async function disableBiometricUnlock(): Promise<void> {
  await SecureStore.deleteItemAsync(SECURE_KEYS.bioToken, tokenOptions(''));
}
