/**
 * Test double for expo-sqlite that behaves like SQLCipher: a database file is
 * encrypted with the key in effect when it is first written, and any later
 * connection with a different key (or no key) gets "file is not a database".
 */
import { createMemoryDatabase } from '../storage/memoryDb';
import type { Database, SqlValue } from '../storage/types';

type StoredFile = { key: string | null; db: Database };

const files = new Map<string, StoredFile>();
let cipherAvailable = true;
/** Every statement sent, in order, so tests can check `PRAGMA key` comes first. */
export const statements: string[] = [];

const KEY_PRAGMA = /^\s*PRAGMA key = "x'([0-9a-f]+)'";?\s*$/i;

class FakeConnection {
  private key: string | null = null;
  private closed = false;

  constructor(private readonly name: string) {}

  private async file(): Promise<Database> {
    if (this.closed) throw new Error('Database is closed');
    const existing = files.get(this.name);
    if (!existing) {
      const db = await createMemoryDatabase();
      files.set(this.name, { key: this.key, db });
      return db;
    }
    if (existing.key !== this.key) throw new Error('file is not a database');
    return existing.db;
  }

  async execAsync(sql: string): Promise<void> {
    statements.push(sql);
    const match = KEY_PRAGMA.exec(sql);
    if (match && cipherAvailable) {
      this.key = match[1];
      return;
    }
    await (await this.file()).exec(sql);
  }

  async runAsync(sql: string, params: SqlValue[] = []) {
    statements.push(sql);
    const { lastInsertRowId } = await (await this.file()).run(sql, params);
    return { changes: 0, lastInsertRowId };
  }

  async getFirstAsync<T>(sql: string, params: SqlValue[] = []): Promise<T | null> {
    statements.push(sql);
    if (/PRAGMA cipher_version/i.test(sql)) {
      return (cipherAvailable ? { cipher_version: '4.6.1 community' } : null) as T | null;
    }
    return (await this.file()).getFirst<T>(sql, params);
  }

  async getAllAsync<T>(sql: string, params: SqlValue[] = []): Promise<T[]> {
    statements.push(sql);
    return (await this.file()).getAll<T>(sql, params);
  }

  async closeAsync(): Promise<void> {
    this.closed = true;
  }
}

export async function openDatabaseAsync(name: string): Promise<FakeConnection> {
  return new FakeConnection(name);
}

export async function deleteDatabaseAsync(name: string): Promise<void> {
  if (!files.delete(name)) throw new Error(`Database ${name} not found`);
}

export function __reset(): void {
  files.clear();
  statements.length = 0;
  cipherAvailable = true;
}

export function __setCipherAvailable(available: boolean): void {
  cipherAvailable = available;
}

export function __hasFile(name: string): boolean {
  return files.has(name);
}

/** The key a file was encrypted with (null = plaintext). */
export function __fileKey(name: string): string | null | undefined {
  return files.get(name)?.key;
}
