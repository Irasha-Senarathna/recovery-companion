import type { Database } from '../../storage/types';

/** Limits keep the encrypted database small and fast. */
export const TEXT_MAX = 500;
export const PHOTO_MAX_BYTES = 1_500_000;
export const VOICE_MAX_BYTES = 2_000_000;
export const VOICE_MAX_MS = 60_000;
export const MAX_ITEMS = 50;

const PHOTO_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/heic'];
const VOICE_TYPES = [
  'audio/mp4',
  'audio/m4a',
  'audio/aac',
  'audio/mpeg',
  'audio/webm',
  'audio/3gpp',
];

export type VaultKind = 'text' | 'photo' | 'voice';
export type VaultErrorCode = 'empty' | 'too_long' | 'too_large' | 'bad_type' | 'full';

export class VaultError extends Error {
  constructor(readonly code: VaultErrorCode) {
    super(`Vault: ${code}`);
    this.name = 'VaultError';
  }
}

/** A vault entry without its media bytes (those load only when shown). */
export type VaultItem = {
  id: number;
  kind: VaultKind;
  text: string | null;
  mime: string | null;
  durationMs: number | null;
  createdAt: number;
};

type Row = {
  id: number;
  kind: VaultKind;
  text: string | null;
  mime: string | null;
  duration_ms: number | null;
  created_at: number;
};

async function ensureRoom(db: Database): Promise<void> {
  const row = await db.getFirst<{ n: number }>('SELECT count(*) AS n FROM vault_items');
  if ((row?.n ?? 0) >= MAX_ITEMS) throw new VaultError('full');
}

export async function addText(db: Database, text: string, now = Date.now()): Promise<number> {
  const clean = text.trim();
  if (!clean) throw new VaultError('empty');
  if (clean.length > TEXT_MAX) throw new VaultError('too_long');
  await ensureRoom(db);
  const result = await db.run(
    "INSERT INTO vault_items (kind, text, created_at) VALUES ('text', ?, ?)",
    [clean, now],
  );
  return result.lastInsertRowId;
}

export async function addPhoto(
  db: Database,
  bytes: Uint8Array,
  mime: string,
  now = Date.now(),
): Promise<number> {
  if (!PHOTO_TYPES.includes(mime)) throw new VaultError('bad_type');
  if (bytes.length === 0) throw new VaultError('empty');
  if (bytes.length > PHOTO_MAX_BYTES) throw new VaultError('too_large');
  await ensureRoom(db);
  const result = await db.run(
    "INSERT INTO vault_items (kind, mime, data, created_at) VALUES ('photo', ?, ?, ?)",
    [mime, bytes, now],
  );
  return result.lastInsertRowId;
}

export async function addVoice(
  db: Database,
  bytes: Uint8Array,
  mime: string,
  durationMs: number,
  now = Date.now(),
): Promise<number> {
  if (!VOICE_TYPES.includes(mime)) throw new VaultError('bad_type');
  if (bytes.length === 0) throw new VaultError('empty');
  if (bytes.length > VOICE_MAX_BYTES) throw new VaultError('too_large');
  if (durationMs > VOICE_MAX_MS) throw new VaultError('too_long');
  await ensureRoom(db);
  const result = await db.run(
    "INSERT INTO vault_items (kind, mime, data, duration_ms, created_at) VALUES ('voice', ?, ?, ?, ?)",
    [mime, bytes, durationMs, now],
  );
  return result.lastInsertRowId;
}

function toItem(row: Row): VaultItem {
  return {
    id: row.id,
    kind: row.kind,
    text: row.text,
    mime: row.mime,
    durationMs: row.duration_ms,
    createdAt: row.created_at,
  };
}

/** Newest first. Media bytes are not loaded here. */
export async function listItems(db: Database): Promise<VaultItem[]> {
  const rows = await db.getAll<Row>(
    'SELECT id, kind, text, mime, duration_ms, created_at FROM vault_items ORDER BY id DESC',
  );
  return rows.map(toItem);
}

export async function getMedia(
  db: Database,
  id: number,
): Promise<{ bytes: Uint8Array; mime: string } | null> {
  const row = await db.getFirst<{ data: Uint8Array | null; mime: string | null }>(
    'SELECT data, mime FROM vault_items WHERE id = ?',
    [id],
  );
  return row?.data && row.mime ? { bytes: new Uint8Array(row.data), mime: row.mime } : null;
}

export async function deleteItem(db: Database, id: number): Promise<void> {
  await db.run('DELETE FROM vault_items WHERE id = ?', [id]);
}

/** One reason to show during SOS. */
export async function randomItem(
  db: Database,
  random: () => number = Math.random,
): Promise<VaultItem | null> {
  const items = await listItems(db);
  return items.length ? items[Math.floor(random() * items.length)] : null;
}
