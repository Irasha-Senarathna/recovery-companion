import type { CheckIn } from '../features/checkin/checkinRepo';
import { TAGS } from '../features/checkin/tags';
import type { SosSession } from '../features/sos/sosRepo';

/** Patterns from fewer check-ins than this would mostly be chance. */
export const MIN_CHECKINS = 14;
/** Each side of a comparison needs at least this many days. */
const MIN_DAYS = 3;
/** Difference in average craving (0–4 scale) worth mentioning. */
const MIN_DIFFERENCE = 0.75;
const MAX_PATTERNS = 4;
const MIN_SESSIONS = 3;
/** The busiest time of day must hold this share of SOS moments to be named. */
const MIN_TIME_SHARE = 0.4;

export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night';

/** "Cravings average `withAvg` on these days, `withoutAvg` on other days." */
export type Pattern = { id: string; withAvg: number; withoutAvg: number; days: number };

export type PatternResult =
  | { ready: false; count: number; needed: number }
  | {
      ready: true;
      count: number;
      patterns: Pattern[];
      hardestTime: TimeOfDay | null;
      /** Some of the check-ins are made-up demo rows (development builds only). */
      usesDemo: boolean;
    };

const weekday = (day: string) => {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(y, m - 1, d).getDay();
};

/** Situations to compare. Ids match i18n keys under `triggers.conditions`. */
const CONDITIONS: [string, (c: CheckIn) => boolean][] = [
  ['poor_sleep', (c) => c.sleep <= 1],
  ['high_stress', (c) => c.stress >= 3],
  ['low_mood', (c) => c.mood <= 1],
  ['weekend', (c) => weekday(c.day) === 0 || weekday(c.day) === 6],
  ...TAGS.filter((tag) => tag !== 'pain').map((tag): [string, (c: CheckIn) => boolean] => [
    `tag_${tag}`,
    (c) => c.tags.includes(tag),
  ]),
];

const mean = (values: number[]) => values.reduce((a, b) => a + b, 0) / values.length;
const round1 = (n: number) => Math.round(n * 10) / 10;

function timeOfDay(hour: number): TimeOfDay {
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 17) return 'afternoon';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'night';
}

function hardestTime(sessions: readonly SosSession[]): TimeOfDay | null {
  if (sessions.length < MIN_SESSIONS) return null;
  const counts = new Map<TimeOfDay, number>();
  for (const s of sessions) {
    const time = timeOfDay(new Date(s.startedAt).getHours());
    counts.set(time, (counts.get(time) ?? 0) + 1);
  }
  const [time, count] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  return count / sessions.length >= MIN_TIME_SHARE ? time : null;
}

/**
 * The user's own patterns, by simple comparison of their check-ins (no model):
 * how strong cravings were on days with a situation versus days without it.
 */
export function findPatterns(
  checkIns: readonly CheckIn[],
  sessions: readonly SosSession[],
): PatternResult {
  if (checkIns.length < MIN_CHECKINS) {
    return { ready: false, count: checkIns.length, needed: MIN_CHECKINS };
  }
  const patterns: Pattern[] = [];
  for (const [id, applies] of CONDITIONS) {
    const withIt = checkIns.filter(applies).map((c) => c.craving);
    const without = checkIns.filter((c) => !applies(c)).map((c) => c.craving);
    if (withIt.length < MIN_DAYS || without.length < MIN_DAYS) continue;
    const withAvg = mean(withIt);
    const withoutAvg = mean(without);
    if (withAvg - withoutAvg >= MIN_DIFFERENCE) {
      patterns.push({
        id,
        withAvg: round1(withAvg),
        withoutAvg: round1(withoutAvg),
        days: withIt.length,
      });
    }
  }
  patterns.sort((a, b) => b.withAvg - b.withoutAvg - (a.withAvg - a.withoutAvg));
  return {
    ready: true,
    count: checkIns.length,
    patterns: patterns.slice(0, MAX_PATTERNS),
    hardestTime: hardestTime(sessions),
    usesDemo: checkIns.some((c) => c.demo),
  };
}
