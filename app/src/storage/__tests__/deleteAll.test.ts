import { savePin } from '../../features/lock/pin';
import { secureStore } from '../../platform/secureStore';
import * as fakeSqlite from '../../test-utils/fakeExpoSqlite';
import { DB_NAME, openDatabase } from '../db';
import { deleteAllData } from '../deleteAll';
import { getOrCreateDbKey } from '../key';
import { SECURE_KEYS } from '../secureKeys';
import { loadSettings, setSetting } from '../settings';

const sqlite = jest.requireMock('expo-sqlite') as typeof fakeSqlite;

async function setUpUser() {
  const key = await getOrCreateDbKey(secureStore);
  const db = await openDatabase(key);
  await setSetting(db, 'nickname', 'Sky');
  await setSetting(db, 'onboarded', 'true');
  await savePin(secureStore, '2468', { iterations: 1000 });
  return db;
}

describe('delete all my data', () => {
  it('removes the database, the key, the PIN and the settings, and cancels notifications', async () => {
    const db = await setUpUser();
    const cancelNotifications = jest.fn(async () => {});

    const result = await deleteAllData({ db, store: secureStore, cancelNotifications });

    expect(result.failed).toEqual([]);
    expect(sqlite.__hasFile(DB_NAME)).toBe(false);
    for (const name of Object.values(SECURE_KEYS)) {
      expect(await secureStore.get(name)).toBeNull();
    }
    expect(cancelNotifications).toHaveBeenCalledTimes(1);
  });

  it('leaves a fresh, empty app behind', async () => {
    const db = await setUpUser();
    await deleteAllData({ db, store: secureStore, cancelNotifications: async () => {} });

    const fresh = await openDatabase(await getOrCreateDbKey(secureStore));
    expect(await loadSettings(fresh)).toMatchObject({ nickname: null, onboarded: false });
  });

  it('still deletes the key (making leftovers unreadable) if a step goes wrong, and reports it', async () => {
    const db = await setUpUser();
    const result = await deleteAllData({
      db,
      store: secureStore,
      cancelNotifications: async () => {},
      deleteDatabaseFile: async () => {
        throw new Error('disk busy');
      },
    });

    expect(result.failed).toEqual(['database']);
    expect(await secureStore.get(SECURE_KEYS.dbKey)).toBeNull();
    expect(await secureStore.get(SECURE_KEYS.pin)).toBeNull();
  });

  it('deletes the database key first and reports if that step fails', async () => {
    const db = await setUpUser();
    const calls: string[] = [];
    const store = {
      get: secureStore.get,
      set: secureStore.set,
      remove: async (key: string) => {
        calls.push(key);
        if (key === SECURE_KEYS.dbKey) throw new Error('keystore busy');
      },
    };
    const result = await deleteAllData({ db, store, cancelNotifications: async () => {} });
    expect(calls[0]).toBe(SECURE_KEYS.dbKey);
    expect(result.failed).toContain('dbKey');
  });

  it('clears temporary media files and reports if that step fails', async () => {
    const db = await setUpUser();
    const clearTempFiles = jest.fn(async () => {
      throw new Error('busy');
    });
    const result = await deleteAllData({
      db,
      store: secureStore,
      cancelNotifications: async () => {},
      clearTempFiles,
    });
    expect(clearTempFiles).toHaveBeenCalledTimes(1);
    expect(result.failed).toEqual(['tempFiles']);
  });

  it('works when the database could not be opened', async () => {
    await setUpUser();
    const result = await deleteAllData({
      db: null,
      store: secureStore,
      cancelNotifications: async () => {},
    });
    expect(result.failed).toEqual([]);
    expect(sqlite.__hasFile(DB_NAME)).toBe(false);
  });
});
