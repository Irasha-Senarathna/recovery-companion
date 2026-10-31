import type { Database } from '../types';

/** Schema changes, in order. Never edit a shipped migration; add a new one. */
export const MIGRATIONS: readonly string[] = [
  `CREATE TABLE settings (
     key   TEXT PRIMARY KEY NOT NULL,
     value TEXT NOT NULL
   );`,
  // M3: Craving SOS sessions and the reasons vault (media kept as BLOBs, never as files).
  `CREATE TABLE sos_sessions (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     started_at  INTEGER NOT NULL,
     ended_at    INTEGER,
     exercise_id TEXT,
     outcome     TEXT CHECK (outcome IN ('passed', 'not_yet', 'unsure'))
   );
   CREATE TABLE vault_items (
     id          INTEGER PRIMARY KEY AUTOINCREMENT,
     kind        TEXT NOT NULL CHECK (kind IN ('text', 'photo', 'voice')),
     text        TEXT,
     mime        TEXT,
     data        BLOB,
     duration_ms INTEGER,
     created_at  INTEGER NOT NULL
   );`,
  // M4: daily check-ins (one per local day). `demo` marks made-up rows from the dev menu.
  `CREATE TABLE check_ins (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     day        TEXT NOT NULL UNIQUE,
     created_at INTEGER NOT NULL,
     mood       INTEGER NOT NULL CHECK (mood BETWEEN 0 AND 4),
     sleep      INTEGER NOT NULL CHECK (sleep BETWEEN 0 AND 4),
     stress     INTEGER NOT NULL CHECK (stress BETWEEN 0 AND 4),
     craving    INTEGER NOT NULL CHECK (craving BETWEEN 0 AND 4),
     tags       TEXT NOT NULL DEFAULT '[]',
     demo       INTEGER NOT NULL DEFAULT 0
   );
   ALTER TABLE sos_sessions ADD COLUMN demo INTEGER NOT NULL DEFAULT 0;`,
  // M5: the user's coping plan (a single row).
  `CREATE TABLE coping_plan (
     id         INTEGER PRIMARY KEY CHECK (id = 1),
     signs      TEXT NOT NULL DEFAULT '',
     helps      TEXT NOT NULL DEFAULT '',
     people     TEXT NOT NULL DEFAULT '',
     updated_at INTEGER NOT NULL
   );`,
  // M6: the user's own names for support-circle links. Never sent to the server.
  `CREATE TABLE circle_labels (
     link_id TEXT PRIMARY KEY NOT NULL,
     role    TEXT NOT NULL CHECK (role IN ('member', 'supporter')),
     label   TEXT NOT NULL
   );`,
  // M7: slips (answers are fixed option ids, never free text) and rebuild goals.
  `CREATE TABLE slips (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     day        TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     place      TEXT,
     feelings   TEXT NOT NULL DEFAULT '[]',
     before     TEXT NOT NULL DEFAULT '[]',
     demo       INTEGER NOT NULL DEFAULT 0
   );
   CREATE TABLE goals (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     area       TEXT NOT NULL CHECK (area IN ('sleep', 'health', 'work', 'family', 'money')),
     title      TEXT NOT NULL,
     created_at INTEGER NOT NULL
   );
   CREATE TABLE goal_wins (
     id         INTEGER PRIMARY KEY AUTOINCREMENT,
     goal_id    INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
     day        TEXT NOT NULL,
     created_at INTEGER NOT NULL,
     UNIQUE (goal_id, day)
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
