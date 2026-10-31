import type { Database } from '../../storage/types';
import { localDay } from '../checkin/checkinRepo';
import { addDays } from './progress';
import { isBefore, isFeeling, isPlace, type SlipAnswers } from './questions';

export type Slip = SlipAnswers & { id: number; day: string; createdAt: number; demo: boolean };

type Row = {
  id: number;
  day: string;
  created_at: number;
  place: string | null;
  feelings: string;
  before: string;
  demo: number;
};

function parseList<T>(raw: string, keep: (v: unknown) => v is T): T[] {
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(keep) : [];
  } catch {
    return [];
  }
}

const fromRow = (row: Row): Slip => ({
  id: row.id,
  day: row.day,
  createdAt: row.created_at,
  place: isPlace(row.place) ? row.place : null,
  feelings: parseList(row.feelings, isFeeling),
  before: parseList(row.before, isBefore),
  demo: row.demo === 1,
});

/**
 * Saves a slip for today or yesterday; the answers can be added later. Only
 * the day is kept: `created_at` is the start of that day, never the exact time.
 */
export async function saveSlip(db: Database, day: string, now = Date.now()): Promise<number> {
  const today = localDay(now);
  if (day !== today && day !== addDays(today, -1)) throw new Error('invalid day');
  const [y, m, d] = day.split('-').map(Number);
  const result = await db.run('INSERT INTO slips (day, created_at) VALUES (?, ?)', [
    day,
    new Date(y, m - 1, d).getTime(),
  ]);
  return result.lastInsertRowId;
}

/** Removes one slip (e.g. logged by mistake); `secure_delete` overwrites it. */
export async function deleteSlip(db: Database, id: number): Promise<void> {
  await db.run('DELETE FROM slips WHERE id = ?', [id]);
}

/** Removes every slip logged for one day. */
export async function deleteSlipsOn(db: Database, day: string): Promise<void> {
  await db.run('DELETE FROM slips WHERE day = ?', [day]);
}

/** Stores the gentle questions' answers; unknown option ids are dropped. */
export async function saveAnswers(db: Database, id: number, answers: SlipAnswers): Promise<void> {
  const clean: SlipAnswers = {
    place: isPlace(answers.place) ? answers.place : null,
    feelings: [...new Set(answers.feelings.filter(isFeeling))],
    before: [...new Set(answers.before.filter(isBefore))],
  };
  await db.run('UPDATE slips SET place = ?, feelings = ?, before = ? WHERE id = ?', [
    clean.place,
    JSON.stringify(clean.feelings),
    JSON.stringify(clean.before),
    id,
  ]);
}

export async function listSlips(db: Database): Promise<Slip[]> {
  const rows = await db.getAll<Row>('SELECT * FROM slips WHERE demo = 0 ORDER BY day, id');
  return rows.map(fromRow);
}

/** Days with at least one slip, oldest first. */
export async function slipDays(db: Database): Promise<string[]> {
  const rows = await db.getAll<{ day: string }>(
    'SELECT DISTINCT day FROM slips WHERE demo = 0 ORDER BY day',
  );
  return rows.map((row) => row.day);
}
