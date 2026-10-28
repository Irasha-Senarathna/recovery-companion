import type { BiometricUnlock } from './biometrics';

/** Web demo stand-in: no biometrics, the PIN is used instead. */
export async function canUseBiometrics(): Promise<boolean> {
  return false;
}

export async function enableBiometricUnlock(): Promise<boolean> {
  return false;
}

export async function unlockWithBiometricToken(): Promise<BiometricUnlock> {
  return 'cancelled';
}

export async function disableBiometricUnlock(): Promise<void> {}
