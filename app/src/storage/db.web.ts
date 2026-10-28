import { createMemoryDatabase } from './memoryDb';
import { migrate } from './migrations';
import type { Database } from './types';

export const DB_NAME = 'recovery.db';

/**
 * Web demo stand-in: an unencrypted in-memory database that is gone on
 * reload. The key is ignored. Never for real data.
 */
export async function openDatabase(_key: string | null): Promise<Database> {
  const db = await createMemoryDatabase();
  await migrate(db);
  return db;
}

/** Nothing on disk to delete: closing the in-memory database discards it. */
export async function deleteDatabaseFile(): Promise<void> {}
