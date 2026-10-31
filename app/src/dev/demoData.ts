import { localDay, saveCheckIn } from '../features/checkin/checkinRepo';
import { EXERCISES } from '../features/sos/exercises';
import type { SosOutcome } from '../features/sos/sosRepo';
import type { Database } from '../storage/types';

/**
 * Made-up data for trying the app (development builds only). Every row is
 * marked `demo = 1`, so clearing never touches what the user entered.
 */
export const DEMO_DAYS = 30;
const SESSIONS = 8;
const SKIP_CHANCE = 0.15;
const MINUTE = 60_000;

/** Small seeded random number generator (mulberry32), for repeatable demos. */
function seeded(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let x = Math.imul(state ^ (state >>> 15), 1 | state);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

const level = (value: number) => Math.min(4, Math.max(0, Math.round(value)));

/** Midday on the day `daysAgo` before `now`, in local time (safe across DST). */
function middayDaysAgo(now: number, daysAgo: number): Date {
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(12, 0, 0, 0);
  return date;
}

export async function loadDemoData(
  db: Database,
  now = Date.now(),
  seed = 42,
): Promise<{ checkIns: number; sessions: number }> {
  const random = seeded(seed);
  let checkIns = 0;

  for (let daysAgo = DEMO_DAYS; daysAgo >= 1; daysAgo--) {
    if (random() < SKIP_CHANCE) continue;
    const date = middayDaysAgo(now, daysAgo);
    const taken = await db.getFirst('SELECT 1 FROM check_ins WHERE day = ?', [localDay(+date)]);
    if (taken) continue;

    // A gentle version of the ml/ pattern: short sleep and stress lift cravings, more at weekends.
    const weekend = date.getDay() === 0 || date.getDay() === 6;
    const sleep = level(2.6 + (random() - 0.5) * 3);
    const stress = level(1.8 + (random() - 0.5) * 3);
    const craving = level(0.6 + (sleep <= 1 ? 1 : 0) + (stress >= 3 ? 1 : 0) + (weekend ? 0.6 : 0));
    const mood = level(2.4 + (sleep - 2) * 0.4 - (stress - 2) * 0.4 + (random() - 0.5));
    const tags = [
      ...(sleep <= 1 ? ['tired'] : []),
      ...(stress >= 3 && !weekend ? ['work_stress'] : []),
      ...(weekend && random() < 0.3 ? ['celebration'] : []),
      ...(random() < 0.15 ? ['bored'] : []),
    ];
    await saveCheckIn(db, { mood, sleep, stress, craving, tags }, +date, { demo: true });
    checkIns++;
  }

  for (let i = 0; i < SESSIONS; i++) {
    const start = +middayDaysAgo(now, 1 + Math.floor(random() * DEMO_DAYS)) + i * MINUTE;
    const outcome: SosOutcome = random() < 0.75 ? 'passed' : random() < 0.5 ? 'unsure' : 'not_yet';
    const exercise = EXERCISES[Math.floor(random() * EXERCISES.length)];
    await db.run(
      'INSERT INTO sos_sessions (started_at, ended_at, exercise_id, outcome, demo) VALUES (?, ?, ?, ?, 1)',
      [start, start + (4 + Math.floor(random() * 16)) * MINUTE, exercise.id, outcome],
    );
  }

  return { checkIns, sessions: SESSIONS };
}

export async function clearDemoData(db: Database): Promise<void> {
  await db.run('DELETE FROM check_ins WHERE demo = 1');
  await db.run('DELETE FROM sos_sessions WHERE demo = 1');
  await db.run('DELETE FROM slips WHERE demo = 1');
  // The start day may have been taken from demo rows; it is set again on next use.
  await db.run("DELETE FROM settings WHERE key = 'journeyStart'");
}
