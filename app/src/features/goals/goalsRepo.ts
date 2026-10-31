import type { Database } from '../../storage/types';
import { localDay } from '../checkin/checkinRepo';

export const AREAS = ['sleep', 'health', 'work', 'family', 'money'] as const;
export type Area = (typeof AREAS)[number];

export const MAX_TITLE_LENGTH = 80;
/** A few goals at a time: rebuilding is not a to-do list. */
export const MAX_GOALS = 6;

export type Goal = {
  id: number;
  area: Area;
  title: string;
  createdAt: number;
  /** Days with a small win logged. */
  wins: number;
  winToday: boolean;
};

const isArea = (v: unknown): v is Area => (AREAS as readonly unknown[]).includes(v);

export async function addGoal(
  db: Database,
  { area, title }: { area: Area; title: string },
  now = Date.now(),
): Promise<number> {
  const clean = title.trim().slice(0, MAX_TITLE_LENGTH);
  if (!isArea(area) || clean === '') throw new Error('invalid goal');
  const count = await db.getFirst<{ n: number }>('SELECT COUNT(*) AS n FROM goals');
  if ((count?.n ?? 0) >= MAX_GOALS) throw new Error('too many goals');
  const result = await db.run('INSERT INTO goals (area, title, created_at) VALUES (?, ?, ?)', [
    area,
    clean,
    now,
  ]);
  return result.lastInsertRowId;
}

export async function deleteGoal(db: Database, id: number): Promise<void> {
  // Foreign keys are not enforced by the app's SQLite setup, so wins go explicitly.
  await db.run('DELETE FROM goal_wins WHERE goal_id = ?', [id]);
  await db.run('DELETE FROM goals WHERE id = ?', [id]);
}

export async function listGoals(db: Database, now = Date.now()): Promise<Goal[]> {
  const rows = await db.getAll<{
    id: number;
    area: string;
    title: string;
    created_at: number;
    wins: number;
    win_today: number;
  }>(
    `SELECT g.id, g.area, g.title, g.created_at,
            COUNT(w.id) AS wins,
            SUM(CASE WHEN w.day = ? THEN 1 ELSE 0 END) AS win_today
       FROM goals g LEFT JOIN goal_wins w ON w.goal_id = g.id
      GROUP BY g.id ORDER BY g.created_at, g.id`,
    [localDay(now)],
  );
  return rows.flatMap((row) =>
    isArea(row.area)
      ? [
          {
            id: row.id,
            area: row.area,
            title: row.title,
            createdAt: row.created_at,
            wins: row.wins,
            winToday: (row.win_today ?? 0) > 0,
          },
        ]
      : [],
  );
}

/** Logs today's small win (once a day) and returns the goal's total. */
export async function logWin(db: Database, goalId: number, now = Date.now()): Promise<number> {
  await db.run(
    'INSERT INTO goal_wins (goal_id, day, created_at) VALUES (?, ?, ?) ON CONFLICT DO NOTHING',
    // Only the day matters; the exact time is not kept.
    [goalId, localDay(now), new Date(now).setHours(0, 0, 0, 0)],
  );
  const row = await db.getFirst<{ n: number }>(
    'SELECT COUNT(*) AS n FROM goal_wins WHERE goal_id = ?',
    [goalId],
  );
  return row?.n ?? 0;
}

export async function undoWin(db: Database, goalId: number, now = Date.now()): Promise<void> {
  await db.run('DELETE FROM goal_wins WHERE goal_id = ? AND day = ?', [goalId, localDay(now)]);
}

const WIN_MILESTONES = [1, 3, 7, 14, 21, 30, 50, 75, 100];

export function nextWinMilestone(wins: number): number {
  return WIN_MILESTONES.find((m) => m > wins) ?? (Math.floor(wins / 50) + 1) * 50;
}

export const isWinMilestone = (wins: number) =>
  WIN_MILESTONES.includes(wins) || (wins > 100 && wins % 50 === 0);
