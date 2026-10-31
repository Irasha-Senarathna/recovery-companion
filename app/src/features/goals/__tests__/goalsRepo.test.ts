import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import {
  addGoal,
  deleteGoal,
  listGoals,
  logWin,
  MAX_GOALS,
  MAX_TITLE_LENGTH,
  nextWinMilestone,
  undoWin,
} from '../goalsRepo';

let db: Database;
beforeEach(async () => {
  db = await createTestDb();
});

const DAY1 = new Date(2026, 9, 1, 10).getTime();
const DAY2 = new Date(2026, 9, 2, 10).getTime();

describe('goals', () => {
  it('adds a goal in one of the five areas, with the user’s own words', async () => {
    await addGoal(db, { area: 'sleep', title: '  In bed by 11  ' }, DAY1);
    const [goal] = await listGoals(db, DAY1);
    expect(goal).toMatchObject({ area: 'sleep', title: 'In bed by 11', wins: 0, winToday: false });
  });

  it('refuses unknown areas and empty titles, and caps the length', async () => {
    await expect(addGoal(db, { area: 'drugs' as never, title: 'x' })).rejects.toThrow();
    await expect(addGoal(db, { area: 'health', title: '   ' })).rejects.toThrow();
    await addGoal(db, { area: 'health', title: 'w'.repeat(500) });
    expect((await listGoals(db))[0].title).toHaveLength(MAX_TITLE_LENGTH);
  });

  it('keeps the list short and kind (at most a handful of goals)', async () => {
    for (let i = 0; i < MAX_GOALS; i++) await addGoal(db, { area: 'family', title: `g${i}` });
    await expect(addGoal(db, { area: 'family', title: 'one more' })).rejects.toThrow();
  });

  it('counts small wins, one per day per goal', async () => {
    const id = await addGoal(db, { area: 'work', title: 'Send one CV' }, DAY1);
    expect(await logWin(db, id, DAY1)).toBe(1);
    expect(await logWin(db, id, DAY1)).toBe(1); // same day: still one
    expect(await logWin(db, id, DAY2)).toBe(2);
    const [goal] = await listGoals(db, DAY2);
    expect(goal).toMatchObject({ wins: 2, winToday: true });
  });

  it('a mistaken tap can be undone for today', async () => {
    const id = await addGoal(db, { area: 'health', title: 'Walk' }, DAY1);
    await logWin(db, id, DAY1);
    await undoWin(db, id, DAY1);
    expect((await listGoals(db, DAY1))[0]).toMatchObject({ wins: 0, winToday: false });
  });

  it('deleting a goal removes its wins too', async () => {
    const id = await addGoal(db, { area: 'money', title: 'Save for a bike' });
    await logWin(db, id);
    await deleteGoal(db, id);
    expect(await listGoals(db)).toEqual([]);
    expect(await db.getAll('SELECT * FROM goal_wins')).toEqual([]);
  });

  it.each([
    [0, 1],
    [1, 3],
    [3, 7],
    [7, 14],
    [30, 50],
    [100, 150],
  ])('after %i wins the next small-win milestone is %i', (wins, next) => {
    expect(nextWinMilestone(wins)).toBe(next);
  });
});
