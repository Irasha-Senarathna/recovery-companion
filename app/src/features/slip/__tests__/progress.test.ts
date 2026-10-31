import { createTestDb } from '../../../test-utils/db';
import { localDay } from '../../checkin/checkinRepo';
import * as repo from '../slipRepo';
import { addDays, computeProgress, journeyDays, nextMilestone } from '../progress';

const START = '2026-09-01';

describe('strong days (safety rule 5: a slip never resets progress)', () => {
  it('counts every finished day since the start', () => {
    const p = computeProgress({ start: START, today: '2026-09-11', slipDays: [] });
    expect(p.strongDays).toBe(10);
    expect(p.longestStretch).toBe(10);
  });

  it('a slip takes away only its own day; the rest still counts', () => {
    const before = computeProgress({ start: START, today: '2026-10-16', slipDays: [] });
    const after = computeProgress({
      start: START,
      today: '2026-10-16',
      slipDays: ['2026-10-15'],
    });
    expect(before.strongDays).toBe(45);
    expect(after.strongDays).toBe(44);
    expect(after.strongDays).toBeGreaterThan(0);
  });

  it('a slip today does not lower the total at all', () => {
    const today = '2026-10-16';
    const before = computeProgress({ start: START, today, slipDays: [] });
    const after = computeProgress({ start: START, today, slipDays: [today] });
    expect(after.strongDays).toBe(before.strongDays);
  });

  it('the total keeps growing after a slip', () => {
    const slipDays = ['2026-09-05'];
    const totals = ['2026-09-06', '2026-09-07', '2026-09-08'].map(
      (today) => computeProgress({ start: START, today, slipDays }).strongDays,
    );
    expect(totals).toEqual([4, 5, 6]);
  });

  it('many slips never bring the total to zero once there were strong days', () => {
    const slipDays = Array.from({ length: 20 }, (_, i) => addDays('2026-09-10', i));
    const p = computeProgress({ start: START, today: '2026-10-01', slipDays });
    expect(p.strongDays).toBe(9 + 1);
  });

  it('keeps the longest stretch even after a slip', () => {
    const p = computeProgress({ start: START, today: '2026-10-01', slipDays: ['2026-09-21'] });
    expect(p.longestStretch).toBe(20);
    expect(p.strongDays).toBe(29);
  });

  it('a slip before the start moves the start back, so it is counted honestly', () => {
    const p = computeProgress({ start: START, today: '2026-09-03', slipDays: ['2026-08-30'] });
    expect(p.start).toBe('2026-08-30');
    expect(p.strongDays).toBe(3);
  });

  it('the first day shows 0, not a negative number', () => {
    expect(computeProgress({ start: START, today: START, slipDays: [] }).strongDays).toBe(0);
  });
});

describe('milestones', () => {
  it.each([
    [0, 1],
    [1, 3],
    [3, 7],
    [29, 30],
    [100, 180],
    [400, 730],
  ])('after %i strong days the next is %i', (days, next) => {
    expect(nextMilestone(days)).toBe(next);
  });
});

describe('journey strip', () => {
  it('marks each of the last days as strong, slip, today or before the start', () => {
    const days = journeyDays({
      start: '2026-09-03',
      today: '2026-09-06',
      slipDays: ['2026-09-04'],
      count: 5,
    });
    expect(days.map((d) => [d.day, d.kind])).toEqual([
      ['2026-09-02', 'before'],
      ['2026-09-03', 'strong'],
      ['2026-09-04', 'slip'],
      ['2026-09-05', 'strong'],
      ['2026-09-06', 'today'],
    ]);
  });
});

describe('slip records', () => {
  it('accepts only today or yesterday, and keeps the day but not the exact time', async () => {
    const db = await createTestDb();
    const now = new Date(2026, 9, 16, 21, 37).getTime();
    const today = localDay(now);
    await repo.saveSlip(db, today, now);
    await repo.saveSlip(db, addDays(today, -1), now);
    await expect(repo.saveSlip(db, addDays(today, -2), now)).rejects.toThrow();
    await expect(repo.saveSlip(db, '2026-99-99', now)).rejects.toThrow();
    const [slip] = await repo.listSlips(db);
    expect(new Date(slip.createdAt).getHours()).toBe(0);
  });

  it('a slip logged by mistake can be removed', async () => {
    const db = await createTestDb();
    const id = await repo.saveSlip(db, localDay());
    await repo.deleteSlip(db, id);
    expect(await repo.slipDays(db)).toEqual([]);
  });
});
