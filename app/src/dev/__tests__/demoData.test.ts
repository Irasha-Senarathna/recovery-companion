import { listCheckIns, localDay, saveCheckIn } from '../../features/checkin/checkinRepo';
import { listSessions } from '../../features/sos/sosRepo';
import type { Database } from '../../storage/types';
import { createTestDb } from '../../test-utils/db';
import { clearDemoData, DEMO_DAYS, loadDemoData } from '../demoData';

const NOW = new Date(2026, 9, 30, 12, 0).getTime();
let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

describe('demo data (development builds only)', () => {
  it('adds made-up check-ins for past days and SOS sessions', async () => {
    const result = await loadDemoData(db, NOW);
    const checkIns = await listCheckIns(db);
    expect(result.checkIns).toBe(checkIns.length);
    expect(checkIns.length).toBeGreaterThan(DEMO_DAYS / 2);
    expect(checkIns.length).toBeLessThanOrEqual(DEMO_DAYS);
    expect(checkIns.every((c) => c.day < localDay(NOW))).toBe(true);
    expect((await listSessions(db)).length).toBe(result.sessions);
    expect(result.sessions).toBeGreaterThan(0);
  });

  it('is the same every time for the same seed', async () => {
    await loadDemoData(db, NOW, 7);
    const other = await createTestDb();
    await loadDemoData(other, NOW, 7);
    expect(await listCheckIns(other)).toEqual(await listCheckIns(db));
  });

  it("never overwrites the user's own check-ins", async () => {
    const yesterday = NOW - 24 * 60 * 60 * 1000;
    await saveCheckIn(db, { mood: 4, sleep: 4, stress: 0, craving: 0, tags: [] }, yesterday);
    await loadDemoData(db, NOW);
    const mine = (await listCheckIns(db)).find((c) => c.day === localDay(yesterday));
    expect(mine).toMatchObject({ mood: 4, sleep: 4, stress: 0, craving: 0 });
  });

  it('clearing removes only demo rows', async () => {
    await saveCheckIn(db, { mood: 1, sleep: 1, stress: 1, craving: 1, tags: [] }, NOW);
    await db.run('INSERT INTO sos_sessions (started_at) VALUES (?)', [NOW]);
    await loadDemoData(db, NOW);
    await clearDemoData(db);
    expect((await listCheckIns(db)).map((c) => c.day)).toEqual([localDay(NOW)]);
    expect(await listSessions(db)).toHaveLength(1);
  });
});
