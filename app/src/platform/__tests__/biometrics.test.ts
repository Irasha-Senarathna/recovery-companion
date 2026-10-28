import * as LocalAuthentication from 'expo-local-authentication';
import * as SecureStore from 'expo-secure-store';
import { SECURE_KEYS } from '../../storage/secureKeys';
import { enableBiometricUnlock, unlockWithBiometricToken } from '../biometrics';

describe('biometric unlock', () => {
  it('needs a successful scan, then stores a token that requires biometrics to read', async () => {
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValueOnce({ success: true });
    expect(await enableBiometricUnlock('Unlock', 'Cancel')).toBe(true);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ disableDeviceFallback: true, biometricsSecurityLevel: 'strong' }),
    );
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SECURE_KEYS.bioToken,
      expect.any(String),
      expect.objectContaining({ requireAuthentication: true }),
    );
  });

  it('is not turned on if the scan does not succeed', async () => {
    jest
      .mocked(LocalAuthentication.authenticateAsync)
      .mockResolvedValueOnce({ success: false, error: 'user_cancel' });
    expect(await enableBiometricUnlock('Unlock', 'Cancel')).toBe(false);
    expect(await SecureStore.getItemAsync(SECURE_KEYS.bioToken)).toBeNull();
  });

  it('unlocks when the token can be read', async () => {
    await SecureStore.setItemAsync(SECURE_KEYS.bioToken, 'token');
    expect(await unlockWithBiometricToken('Unlock')).toBe('ok');
  });

  it('reports "invalidated" when a new fingerprint or face was enrolled (token gone)', async () => {
    expect(await unlockWithBiometricToken('Unlock')).toBe('invalidated');
  });

  it('reports "cancelled" when the scan is cancelled', async () => {
    jest.mocked(SecureStore.getItemAsync).mockRejectedValueOnce(new Error('cancelled'));
    expect(await unlockWithBiometricToken('Unlock')).toBe('cancelled');
  });
});
