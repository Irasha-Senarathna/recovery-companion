import { secureStore } from '../../../platform/secureStore';
import { DB_NAME, openDatabase } from '../../../storage/db';
import { getOrCreateDbKey } from '../../../storage/key';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import * as fakeSqlite from '../../../test-utils/fakeExpoSqlite';
import { getCheckIn, listCheckIns, localDay, saveCheckIn, type CheckInInput } from '../checkinRepo';
import { MEASURES, TAGS } from '../tags';
import config from '../../../../../content/checkin.json';

const sqlite = jest.requireMock('expo-sqlite') as typeof fakeSqlite;

const answers: CheckInInput = { mood: 3, sleep: 1, stress: 4, craving: 2, tags: ['tired'] };
const NOON = new Date(2026, 9, 30, 12, 0).getTime();

describe('localDay', () => {
  it('is the local calendar day as YYYY-MM-DD', () => {
    expect(localDay(new Date(2026, 0, 5, 23, 59).getTime())).toBe('2026-01-05');
    expect(localDay(new Date(2026, 11, 31, 0, 1).getTime())).toBe('2026-12-31');
  });
});

describe('tags and measures', () => {
  it('come from the shared content/checkin.json (also used by ml/)', () => {
    expect([...MEASURES]).toEqual(config.measures);
    expect([...TAGS]).toEqual(config.tags);
  });
});

describe('check-ins', () => {
  let db: Database;
  beforeEach(async () => {
    db = await createTestDb();
  });

  it('saves the four answers and tags in the encrypted database', async () => {
    const key = await getOrCreateDbKey(secureStore);
    const encrypted = await openDatabase(key);
    await saveCheckIn(encrypted, answers, NOON);
    await encrypted.close();

    const reopened = await openDatabase(key);
    expect(await getCheckIn(reopened, '2026-10-30')).toMatchObject({
      ...answers,
      day: '2026-10-30',
      createdAt: NOON,
    });
    expect(sqlite.__fileKey(DB_NAME)).toBe(key);
  });

  it('keeps one check-in per day: saving again the same day replaces it', async () => {
    await saveCheckIn(db, answers, NOON);
    await saveCheckIn(db, { ...answers, mood: 0, tags: [] }, NOON + 60_000);
    const all = await listCheckIns(db);
    expect(all).toHaveLength(1);
    expect(all[0]).toMatchObject({ mood: 0, tags: [], createdAt: NOON + 60_000 });
  });

  it('lists the newest day first', async () => {
    const day = 24 * 60 * 60 * 1000;
    await saveCheckIn(db, answers, NOON - 2 * day);
    await saveCheckIn(db, answers, NOON);
    await saveCheckIn(db, answers, NOON - day);
    expect((await listCheckIns(db)).map((c) => c.day)).toEqual([
      '2026-10-30',
      '2026-10-29',
      '2026-10-28',
    ]);
  });

  it('returns null for a day without a check-in', async () => {
    expect(await getCheckIn(db, '2026-10-30')).toBeNull();
  });

  it.each([-1, 5, 2.5, NaN])('refuses a level of %p', async (level) => {
    await expect(saveCheckIn(db, { ...answers, stress: level }, NOON)).rejects.toThrow();
    expect(await listCheckIns(db)).toEqual([]);
  });

  it('refuses unknown tags and stores each tag once', async () => {
    await expect(saveCheckIn(db, { ...answers, tags: ['made-up'] }, NOON)).rejects.toThrow();
    await saveCheckIn(db, { ...answers, tags: ['bored', 'bored', 'alone'] }, NOON);
    expect((await getCheckIn(db, '2026-10-30'))?.tags).toEqual(['bored', 'alone']);
  });

  it('a real check-in replaces demo data for the same day', async () => {
    await saveCheckIn(db, answers, NOON, { demo: true });
    await saveCheckIn(db, answers, NOON);
    const row = await db.getFirst<{ demo: number }>('SELECT demo FROM check_ins');
    expect(row?.demo).toBe(0);
  });
});
