import { bytesToHex } from '@noble/hashes/utils.js';
import { getRandomBytesAsync } from 'expo-crypto';
import type { KeyStore } from '../platform/keyStore';
import { SECURE_KEYS } from './secureKeys';

const KEY_BYTES = 32; // 256-bit SQLCipher raw key

export function isValidDbKey(key: string | null | undefined): key is string {
  return typeof key === 'string' && /^[0-9a-f]{64}$/.test(key);
}

export async function getDbKey(store: KeyStore): Promise<string | null> {
  return store.get(SECURE_KEYS.dbKey);
}

/** Returns the database key, creating a random one on first launch. */
export async function getOrCreateDbKey(store: KeyStore): Promise<string> {
  const existing = await getDbKey(store);
  if (existing) return existing;
  const key = bytesToHex(await getRandomBytesAsync(KEY_BYTES));
  await store.set(SECURE_KEYS.dbKey, key);
  return key;
}
