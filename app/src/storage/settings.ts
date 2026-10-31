import { isLanguage, type Language } from '../i18n';
import type { Database } from './types';

export type AppSettings = {
  nickname: string | null;
  language: Language | null;
  onboarded: boolean;
  biometricEnabled: boolean;
  shakeToHide: boolean;
  /** "Call my support person": stays on this phone, never sent anywhere. */
  supportName: string | null;
  supportPhone: string | null;
  /** Daily check-in reminder, scheduled on this phone only. */
  reminderEnabled: boolean;
  reminderHour: number;
  reminderMinute: number;
  /** Early-warning heads-up on harder days (off until the user turns it on). */
  nudgesEnabled: boolean;
  /** When today's heads-up was scheduled for; at most one a day. */
  lastNudgeAt: number | null;
  /** Supporter mode: a push when someone asks for a check-in (off until opted in). */
  circleNotify: boolean;
  /** The day strong days are counted from ("YYYY-MM-DD"); set on first use, changeable. */
  journeyStart: string | null;
  /** What the user used to spend a day, in rupees, for "money saved" (optional). */
  moneyPerDay: number | null;
};

export type SettingKey = keyof AppSettings;

export const DEFAULT_SETTINGS: AppSettings = {
  nickname: null,
  language: null,
  onboarded: false,
  biometricEnabled: false,
  shakeToHide: false,
  supportName: null,
  supportPhone: null,
  reminderEnabled: false,
  reminderHour: 20,
  reminderMinute: 0,
  nudgesEnabled: false,
  lastNudgeAt: null,
  circleNotify: false,
  journeyStart: null,
  moneyPerDay: null,
};

/** A whole number in [0, max), or the fallback. */
function parseInRange(value: string | undefined, max: number, fallback: number): number {
  const n = Number(value);
  return Number.isInteger(n) && n >= 0 && n < max ? n : fallback;
}

/** Same bound as the goals screen allows (1,000,000 a day). */
function parseMoney(value: string | undefined): number | null {
  const n = Number(value);
  return value !== undefined && Number.isSafeInteger(n) && n > 0 && n <= 1_000_000 ? n : null;
}

function parseDay(value: string | undefined): string | null {
  return value && /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : null;
}

function parseTime(value: string | undefined): number | null {
  const n = Number(value);
  return value !== undefined && Number.isSafeInteger(n) && n > 0 ? n : null;
}

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
    supportName: raw.get('supportName') ?? null,
    supportPhone: raw.get('supportPhone') ?? null,
    reminderEnabled: raw.get('reminderEnabled') === 'true',
    reminderHour: parseInRange(raw.get('reminderHour'), 24, DEFAULT_SETTINGS.reminderHour),
    reminderMinute: parseInRange(raw.get('reminderMinute'), 60, DEFAULT_SETTINGS.reminderMinute),
    nudgesEnabled: raw.get('nudgesEnabled') === 'true',
    lastNudgeAt: parseTime(raw.get('lastNudgeAt')),
    circleNotify: raw.get('circleNotify') === 'true',
    journeyStart: parseDay(raw.get('journeyStart')),
    moneyPerDay: parseMoney(raw.get('moneyPerDay')),
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
