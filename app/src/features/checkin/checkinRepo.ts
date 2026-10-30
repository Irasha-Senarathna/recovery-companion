import type { Database } from '../../storage/types';
import { isLevel, isTag, MEASURES, type Measure, type Tag } from './tags';

export type Levels = Record<Measure, number>;
export type CheckInInput = Levels & { tags: Tag[] };
export type CheckIn = CheckInInput & { id: number; day: string; createdAt: number };

type Row = Levels & { id: number; day: string; created_at: number; tags: string };

/** The phone's local calendar day as YYYY-MM-DD. */
export function localDay(time = Date.now()): string {
  const date = new Date(time);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function validate(input: CheckInInput): Tag[] {
  for (const measure of MEASURES) {
    if (!isLevel(input[measure])) throw new Error(`Invalid ${measure}`);
  }
  if (!input.tags.every(isTag)) throw new Error('Unknown tag');
  return [...new Set(input.tags)];
}

/**
 * One check-in per day: saving again the same day replaces that day's answers.
 * `demo` marks made-up rows from the dev menu; a real save clears it.
 */
export async function saveCheckIn(
  db: Database,
  input: CheckInInput,
  now = Date.now(),
  { demo = false } = {},
): Promise<void> {
  const tags = validate(input);
  await db.run(
    `INSERT INTO check_ins (day, created_at, mood, sleep, stress, craving, tags, demo)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(day) DO UPDATE SET
       created_at = excluded.created_at, mood = excluded.mood, sleep = excluded.sleep,
       stress = excluded.stress, craving = excluded.craving, tags = excluded.tags,
       demo = excluded.demo`,
    [
      localDay(now),
      now,
      input.mood,
      input.sleep,
      input.stress,
      input.craving,
      JSON.stringify(tags),
      demo ? 1 : 0,
    ],
  );
}

function toCheckIn(row: Row): CheckIn {
  let tags: unknown;
  try {
    tags = JSON.parse(row.tags);
  } catch {
    tags = [];
  }
  return {
    id: row.id,
    day: row.day,
    createdAt: row.created_at,
    mood: row.mood,
    sleep: row.sleep,
    stress: row.stress,
    craving: row.craving,
    // A tag removed from the list in a later version is dropped quietly.
    tags: Array.isArray(tags) ? tags.filter(isTag) : [],
  };
}

const COLUMNS = 'id, day, created_at, mood, sleep, stress, craving, tags';

export async function getCheckIn(db: Database, day: string): Promise<CheckIn | null> {
  const row = await db.getFirst<Row>(`SELECT ${COLUMNS} FROM check_ins WHERE day = ?`, [day]);
  return row ? toCheckIn(row) : null;
}

/** Newest day first. */
export async function listCheckIns(db: Database): Promise<CheckIn[]> {
  const rows = await db.getAll<Row>(`SELECT ${COLUMNS} FROM check_ins ORDER BY day DESC`);
  return rows.map(toCheckIn);
}
