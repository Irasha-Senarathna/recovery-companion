import * as SecureStore from 'expo-secure-store';
import type { KeyStore } from './keyStore';

// Phone: Android Keystore / iOS Keychain. Never synced or backed up.
const options = { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY };

export const secureStore: KeyStore = {
  get: (key) => SecureStore.getItemAsync(key, options),
  set: (key, value) => SecureStore.setItemAsync(key, value, options),
  remove: (key) => SecureStore.deleteItemAsync(key, options),
};
