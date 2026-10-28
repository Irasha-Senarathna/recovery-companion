import initSqlJs from 'sql.js/dist/sql-asm.js';
import type { Database, SqlValue } from './types';

type SqlJs = Awaited<ReturnType<typeof initSqlJs>>;
let sqlJs: Promise<SqlJs> | null = null;

/**
 * An in-memory SQLite database (sql.js, pure JS). Used by the web demo and by
 * tests. Nothing is written to disk and nothing is encrypted, so it must never
 * hold real data.
 */
export async function createMemoryDatabase(): Promise<Database> {
  sqlJs ??= initSqlJs();
  const db = new (await sqlJs).Database();

  const all = <T>(sql: string, params: SqlValue[] = []): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params = []) => {
      db.run(sql, params);
    },
    getFirst: async <T>(sql: string, params?: SqlValue[]) => all<T>(sql, params)[0] ?? null,
    getAll: async <T>(sql: string, params?: SqlValue[]) => all<T>(sql, params),
    close: async () => {
      db.close();
    },
  };
}
