import * as SQLite from 'expo-sqlite';
import { isValidDbKey } from './key';
import { migrate } from './migrations';
import { StorageError, type Database } from './types';

export const DB_NAME = 'recovery.db';

/**
 * Opens the SQLCipher-encrypted database. Refuses to open without a valid key,
 * with a wrong key, or on a build without SQLCipher (which would silently
 * store everything unencrypted).
 */
export async function openDatabase(key: string | null): Promise<Database> {
  if (!isValidDbKey(key)) throw new StorageError('no_key');

  const sqlite = await SQLite.openDatabaseAsync(DB_NAME);
  try {
    const cipher = await sqlite.getFirstAsync('PRAGMA cipher_version');
    if (!cipher) throw new StorageError('no_cipher');

    // Raw 256-bit key; the hex is validated above, so it is safe to inline.
    await sqlite.execAsync(`PRAGMA key = "x'${key}'";`);
    await checkKey(sqlite);

    const db = wrap(sqlite);
    await migrate(db);
    return db;
  } catch (error) {
    await sqlite.closeAsync();
    throw error;
  }
}

export async function deleteDatabaseFile(): Promise<void> {
  await SQLite.deleteDatabaseAsync(DB_NAME);
}

/** SQLCipher only notices a wrong key on the first read. */
async function checkKey(sqlite: SQLite.SQLiteDatabase): Promise<void> {
  try {
    await sqlite.getFirstAsync('SELECT count(*) AS n FROM sqlite_master');
  } catch {
    throw new StorageError('wrong_key');
  }
}

function wrap(sqlite: SQLite.SQLiteDatabase): Database {
  return {
    exec: (sql) => sqlite.execAsync(sql),
    run: async (sql, params = []) => {
      await sqlite.runAsync(sql, params);
    },
    getFirst: (sql, params = []) => sqlite.getFirstAsync(sql, params),
    getAll: (sql, params = []) => sqlite.getAllAsync(sql, params),
    close: () => sqlite.closeAsync(),
  };
}
