import { createMemoryDatabase } from '../storage/memoryDb';
import { migrate } from '../storage/migrations';
import type { Database } from '../storage/types';

/** A fresh, migrated in-memory database for tests. */
export async function createTestDb(): Promise<Database> {
  const db = await createMemoryDatabase();
  await migrate(db);
  return db;
}
