/**
 * Strong days: finished days since the start without a slip. A slip removes
 * only its own day, so progress never resets (safety rule 5). Today counts
 * once it is over, which means logging a slip today never lowers the number.
 */

/** "YYYY-MM-DD" ± n days, by the calendar (no time zones involved). */
export function addDays(day: string, n: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y, m - 1, d + n));
  return date.toISOString().slice(0, 10);
}

/** Whole days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: string, to: string): number {
  const utc = (day: string) => {
    const [y, m, d] = day.split('-').map(Number);
    return Date.UTC(y, m - 1, d);
  };
  return Math.round((utc(to) - utc(from)) / 86_400_000);
}

export type Progress = {
  /** The day counting starts from (moved back if a slip was logged earlier). */
  start: string;
  strongDays: number;
  /** Longest run of strong days in a row. It never goes down. */
  longestStretch: number;
  next: number;
};

type Input = { start: string; today: string; slipDays: readonly string[] };

function effectiveStart(start: string, slipDays: readonly string[]): string {
  return slipDays.reduce((earliest, day) => (day < earliest ? day : earliest), start);
}

export function computeProgress({ start, today, slipDays }: Input): Progress {
  const from = effectiveStart(start, slipDays);
  const slips = new Set(slipDays);
  let strongDays = 0;
  let run = 0;
  let longestStretch = 0;
  for (let day = from; day < today; day = addDays(day, 1)) {
    if (slips.has(day)) {
      run = 0;
      continue;
    }
    strongDays += 1;
    run += 1;
    longestStretch = Math.max(longestStretch, run);
  }
  return { start: from, strongDays, longestStretch, next: nextMilestone(strongDays) };
}

const MILESTONES = [1, 3, 7, 14, 30, 60, 90, 180, 365];

/** The next gentle milestone above `days` (then one each year). */
export function nextMilestone(days: number): number {
  const next = MILESTONES.find((m) => m > days);
  return next ?? (Math.floor(days / 365) + 1) * 365;
}

/** The milestone before `next` (0 before the first), so a ring fills between them. */
export function previousMilestone(next: number): number {
  const index = MILESTONES.indexOf(next);
  if (index === 0) return 0;
  return index > 0 ? MILESTONES[index - 1] : next - 365;
}

export type JourneyDay = { day: string; kind: 'before' | 'strong' | 'slip' | 'today' };

/** The last `count` days for the journey strip, oldest first. */
export function journeyDays({ start, today, slipDays, count }: Input & { count: number }) {
  const from = effectiveStart(start, slipDays);
  const slips = new Set(slipDays);
  return Array.from({ length: count }, (_, i): JourneyDay => {
    const day = addDays(today, i - count + 1);
    const kind =
      day === today ? 'today' : day < from ? 'before' : slips.has(day) ? 'slip' : 'strong';
    return { day, kind };
  });
}
