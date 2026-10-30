import { secureStore } from '../../../platform/secureStore';
import { DB_NAME, openDatabase } from '../../../storage/db';
import { getOrCreateDbKey } from '../../../storage/key';
import * as fakeSqlite from '../../../test-utils/fakeExpoSqlite';
import { finishSession, listSessions, setSessionExercise, startSession } from '../sosRepo';

const sqlite = jest.requireMock('expo-sqlite') as typeof fakeSqlite;

describe('SOS sessions', () => {
  it('saves start, exercise, end and outcome in the encrypted database', async () => {
    const key = await getOrCreateDbKey(secureStore);
    const db = await openDatabase(key);

    const id = await startSession(db, 1_000);
    await setSessionExercise(db, id, 'box-breathing');
    await finishSession(db, id, 'passed', 601_000);
    await db.close();

    const reopened = await openDatabase(key);
    expect(await listSessions(reopened)).toEqual([
      { id, startedAt: 1_000, endedAt: 601_000, exerciseId: 'box-breathing', outcome: 'passed' },
    ]);
    expect(sqlite.__fileKey(DB_NAME)).toBe(key);
  });

  it('keeps sessions that were left without an answer', async () => {
    const db = await openDatabase(await getOrCreateDbKey(secureStore));
    const id = await startSession(db, 5);
    expect(await listSessions(db)).toEqual([
      { id, startedAt: 5, endedAt: null, exerciseId: null, outcome: null },
    ]);
  });

  it('lists the newest session first', async () => {
    const db = await openDatabase(await getOrCreateDbKey(secureStore));
    const first = await startSession(db, 1);
    const second = await startSession(db, 2);
    expect((await listSessions(db)).map((s) => s.id)).toEqual([second, first]);
  });

  it('rejects unknown outcomes', async () => {
    const db = await openDatabase(await getOrCreateDbKey(secureStore));
    const id = await startSession(db, 1);
    await expect(finishSession(db, id, 'nonsense' as never, 2)).rejects.toThrow();
  });
});
