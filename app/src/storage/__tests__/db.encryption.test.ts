import * as SecureStore from 'expo-secure-store';
import { secureStore } from '../../platform/secureStore';
import * as fakeSqlite from '../../test-utils/fakeExpoSqlite';
import { DB_NAME, openDatabase } from '../db';
import { getDbKey, getOrCreateDbKey, isValidDbKey } from '../key';
import { getSetting, setSetting } from '../settings';
import { SECURE_KEYS } from '../secureKeys';
import { StorageError } from '../types';

const sqlite = jest.requireMock('expo-sqlite') as typeof fakeSqlite;

async function expectStorageError(promise: Promise<unknown>, code: StorageError['code']) {
  await expect(promise).rejects.toBeInstanceOf(StorageError);
  await expect(promise).rejects.toMatchObject({ code });
}

describe('database key', () => {
  it('is created on first launch as a random 256-bit key', async () => {
    const key = await getOrCreateDbKey(secureStore);
    expect(isValidDbKey(key)).toBe(true);
    expect(key).toHaveLength(64);
  });

  it('is stored only in the secure store and reused on the next launch', async () => {
    const key = await getOrCreateDbKey(secureStore);
    expect(SecureStore.setItemAsync).toHaveBeenCalledWith(
      SECURE_KEYS.dbKey,
      key,
      expect.objectContaining({ keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY }),
    );
    expect(await getOrCreateDbKey(secureStore)).toBe(key);
    expect(await getDbKey(secureStore)).toBe(key);
  });

  it('differs between installs', async () => {
    const first = await getOrCreateDbKey(secureStore);
    await secureStore.remove(SECURE_KEYS.dbKey);
    expect(await getOrCreateDbKey(secureStore)).not.toBe(first);
  });
});

describe('encrypted database', () => {
  it('opens with the right key and keeps data between launches', async () => {
    const key = await getOrCreateDbKey(secureStore);
    const db = await openDatabase(key);
    await setSetting(db, 'nickname', 'Sky');
    await db.close();

    const reopened = await openDatabase(key);
    expect(await getSetting(reopened, 'nickname')).toBe('Sky');
  });

  it('is encrypted with the key from the secure store', async () => {
    const key = await getOrCreateDbKey(secureStore);
    await openDatabase(key);
    expect(sqlite.__fileKey(DB_NAME)).toBe(key);
  });

  it('sets the key before any other statement touches the file', async () => {
    const key = await getOrCreateDbKey(secureStore);
    await openDatabase(key);
    const keyIndex = sqlite.statements.findIndex((s) => s.startsWith('PRAGMA key'));
    expect(keyIndex).toBeGreaterThan(-1);
    const before = sqlite.statements.slice(0, keyIndex);
    expect(before.every((s) => /PRAGMA cipher_version/i.test(s))).toBe(true);
  });

  it('cannot be opened with a wrong key', async () => {
    const key = await getOrCreateDbKey(secureStore);
    await (await openDatabase(key)).close();
    const wrongKey = key.replace(/^./, key[0] === 'a' ? 'b' : 'a');
    await expectStorageError(openDatabase(wrongKey), 'wrong_key');
  });

  it.each([null, '', 'not-a-key', 'ab'.repeat(16)])(
    'cannot be opened with no key (%p)',
    async (key) => {
      await expectStorageError(openDatabase(key), 'no_key');
      expect(sqlite.__hasFile(DB_NAME)).toBe(false);
    },
  );

  it('refuses to run unencrypted on a build without SQLCipher', async () => {
    sqlite.__setCipherAvailable(false);
    const key = await getOrCreateDbKey(secureStore);
    await expectStorageError(openDatabase(key), 'no_cipher');
    expect(sqlite.__hasFile(DB_NAME)).toBe(false);
  });

  it('never writes the key into the database', async () => {
    const key = await getOrCreateDbKey(secureStore);
    const db = await openDatabase(key);
    const rows = await db.getAll<{ value: string }>('SELECT value FROM settings');
    expect(rows.some((row) => row.value.includes(key))).toBe(false);
  });
});
