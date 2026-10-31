import { TAGS } from '../features/checkin/tags';

/**
 * The same features as ml/features.py, in the same order. A parity test
 * checks both give identical numbers on fixtures exported from Python.
 */
export const FEATURES: readonly string[] = [
  'mood',
  'sleep',
  'stress',
  'craving',
  'poor_sleep',
  'high_stress',
  'weekend',
  'poor_sleep_high_stress_weekend',
  'craving_recent',
  'stress_recent',
  'slip_recent',
  ...TAGS.map((tag) => `tag_${tag}`),
];

/** The fields a check-in needs for the model (the repo's CheckIn has more). */
export type CheckInLike = {
  day: string;
  mood: number;
  sleep: number;
  stress: number;
  craving: number;
  tags: readonly string[];
};

const RECENT_DAYS = 3;

/** Whole days since 1970 for a "YYYY-MM-DD" day, ignoring time zones. */
function dayNumber(day: string): number {
  const [y, m, d] = day.split('-').map(Number);
  return Date.UTC(y, m - 1, d) / 86_400_000;
}

function isWeekend(day: string): boolean {
  const weekday = new Date(dayNumber(day) * 86_400_000).getUTCDay();
  return weekday === 0 || weekday === 6;
}

/** Mean over check-ins in the 3 days before today; today's value if there are none. */
function recentMean(
  today: CheckInLike,
  previous: readonly CheckInLike[],
  measure: 'craving' | 'stress',
) {
  const now = dayNumber(today.day);
  const window = previous
    .filter((c) => {
      const n = dayNumber(c.day);
      return n >= now - RECENT_DAYS && n < now;
    })
    .map((c) => c[measure]);
  return window.length ? window.reduce((a, b) => a + b, 0) / window.length : today[measure];
}

/** A slip in the 3 days before today (today's own slip is what is predicted, not a feature). */
function slipRecent(today: CheckInLike, slipDays: readonly string[]): boolean {
  const now = dayNumber(today.day);
  return slipDays.some((day) => {
    const n = dayNumber(day);
    return n >= now - RECENT_DAYS && n < now;
  });
}

/**
 * `previous` may contain any of the user's check-ins and `slipDays` any slip
 * days ("YYYY-MM-DD"); later days are ignored.
 */
export function buildFeatures(
  today: CheckInLike,
  previous: readonly CheckInLike[],
  slipDays: readonly string[] = [],
): number[] {
  const poorSleep = today.sleep <= 1;
  const highStress = today.stress >= 3;
  const weekend = isWeekend(today.day);
  const flag = (on: boolean) => (on ? 1 : 0);
  return [
    today.mood,
    today.sleep,
    today.stress,
    today.craving,
    flag(poorSleep),
    flag(highStress),
    flag(weekend),
    flag(poorSleep && highStress && weekend),
    recentMean(today, previous, 'craving'),
    recentMean(today, previous, 'stress'),
    flag(slipRecent(today, slipDays)),
    ...TAGS.map((tag) => flag(today.tags.includes(tag))),
  ];
}
