import type { Database } from '../types';

/** Schema changes, in order. Never edit a shipped migration; add a new one. */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE settings (
     key   TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );`,
];

/** Brings the schema up to date, tracking the version in PRAGMA user_version. */
export async function migrate(db: Database): Promise<void> {
  const row = await db.getFirst<{ user_version: number }>('PRAGMA user_version');
  const current = row?.user_version ?? 0;

  for (let version = current; version < MIGRATIONS.length; version++) {
    try {
      await db.exec(`BEGIN; ${MIGRATIONS[version]} PRAGMA user_version = ${version + 1}; COMMIT;`);
    } catch (error) {
      await db.exec('ROLLBACK');
      throw error;
    }
  }
}
