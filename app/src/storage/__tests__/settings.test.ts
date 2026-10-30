import { createMemoryDatabase } from '../memoryDb';
import { migrate } from '../migrations';
import { getSetting, loadSettings, saveSettings } from '../settings';

async function freshDb() {
  const db = await createMemoryDatabase();
  await migrate(db);
  return db;
}

describe('settings', () => {
  it('saves and loads typed values', async () => {
    const db = await freshDb();
    await saveSettings(db, { nickname: 'Sky', language: 'ta', shakeToHide: true });
    expect(await loadSettings(db)).toMatchObject({
      nickname: 'Sky',
      language: 'ta',
      shakeToHide: true,
      biometricEnabled: false,
    });
  });

  it('removes a value saved as null (nothing is kept that the user cleared)', async () => {
    const db = await freshDb();
    await saveSettings(db, { nickname: 'Sky' });
    await saveSettings(db, { nickname: null });
    expect(await getSetting(db, 'nickname')).toBeNull();
  });
});

describe('reminder settings', () => {
  it('default to off at 20:00', async () => {
    expect(await loadSettings(await freshDb())).toMatchObject({
      reminderEnabled: false,
      reminderHour: 20,
      reminderMinute: 0,
    });
  });

  it('round-trip and ignore impossible times', async () => {
    const db = await freshDb();
    await saveSettings(db, { reminderEnabled: true, reminderHour: 7, reminderMinute: 45 });
    expect(await loadSettings(db)).toMatchObject({
      reminderEnabled: true,
      reminderHour: 7,
      reminderMinute: 45,
    });
    await saveSettings(db, { reminderHour: 31, reminderMinute: 75 });
    expect(await loadSettings(db)).toMatchObject({ reminderHour: 20, reminderMinute: 0 });
  });
});

describe('migrate', () => {
  it('is safe to run twice', async () => {
    const db = await freshDb();
    await migrate(db);
    expect(await db.getFirst('PRAGMA user_version')).toEqual({ user_version: 3 });
  });
});
