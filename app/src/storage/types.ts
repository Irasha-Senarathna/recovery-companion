export type SqlValue = string | number | null | Uint8Array;

export type RunResult = { lastInsertRowId: number };

/** The small SQL surface the app uses. Implemented by SQLCipher on the phone. */
export interface Database {
  exec(sql: string): Promise<void>;
  run(sql: string, params?: SqlValue[]): Promise<RunResult>;
  getFirst<T>(sql: string, params?: SqlValue[]): Promise<T | null>;
  getAll<T>(sql: string, params?: SqlValue[]): Promise<T[]>;
  close(): Promise<void>;
}

export type StorageErrorCode = 'no_key' | 'no_cipher' | 'wrong_key';

export class StorageError extends Error {
  constructor(readonly code: StorageErrorCode) {
    super(`Storage error: ${code}`);
    this.name = 'StorageError';
  }
}
