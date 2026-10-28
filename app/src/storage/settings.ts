import { isLanguage, type Language } from '../i18n';
import type { Database } from './types';

export type AppSettings = {
  nickname: string | null;
  language: Language | null;
  onboarded: boolean;
  biometricEnabled: boolean;
  shakeToHide: boolean;
};

export type SettingKey = keyof AppSettings;

export const DEFAULT_SETTINGS: AppSettings = {
  nickname: null,
  language: null,
  onboarded: false,
  biometricEnabled: false,
  shakeToHide: false,
};

export async function getSetting(db: Database, key: SettingKey): Promise<string | null> {
  const row = await db.getFirst<{ value: string }>('SELECT value FROM settings WHERE key = ?', [
    key,
  ]);
  return row?.value ?? null;
}

export async function setSetting(db: Database, key: SettingKey, value: string): Promise<void> {
  await db.run(
    'INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    [key, value],
  );
}

export async function loadSettings(db: Database): Promise<AppSettings> {
  const rows = await db.getAll<{ key: string; value: string }>('SELECT key, value FROM settings');
  const raw = new Map(rows.map((row) => [row.key, row.value]));
  const language = raw.get('language');
  return {
    nickname: raw.get('nickname') ?? null,
    language: isLanguage(language) ? language : null,
    onboarded: raw.get('onboarded') === 'true',
    biometricEnabled: raw.get('biometricEnabled') === 'true',
    shakeToHide: raw.get('shakeToHide') === 'true',
  };
}

/** Saves the given settings; `null` removes the stored value. */
export async function saveSettings(db: Database, patch: Partial<AppSettings>): Promise<void> {
  for (const [key, value] of Object.entries(patch)) {
    if (value === null) {
      await db.run('DELETE FROM settings WHERE key = ?', [key]);
    } else if (value !== undefined) {
      await setSetting(db, key as SettingKey, String(value));
    }
  }
}
