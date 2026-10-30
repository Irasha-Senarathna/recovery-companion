import { localDay } from '../features/checkin/checkinRepo';
import type { SosSession } from '../features/sos/sosRepo';

/** No nudges from 22:00 to 08:00. */
export const QUIET_START = 22;
export const QUIET_END = 8;
/** Used until there are enough SOS moments to know the user's own hard time. */
export const DEFAULT_PEAK_HOUR = 18;
const LEAD_MINUTES = 60;
/** Closer than this, the user is likely in the app already: show it there instead. */
const MIN_NOTICE_MINUTES = 5;
const MIN_SESSIONS = 3;
const MINUTE = 60_000;

const inQuietHours = (hour: number) => hour >= QUIET_START || hour < QUIET_END;

/** Median start hour of SOS moments outside quiet hours; early evening by default. */
export function peakHour(sessions: readonly SosSession[]): number {
  const hours = sessions
    .map((s) => new Date(s.startedAt).getHours())
    .filter((h) => !inQuietHours(h))
    .sort((a, b) => a - b);
  if (hours.length < MIN_SESSIONS) return DEFAULT_PEAK_HOUR;
  return hours[Math.floor(hours.length / 2)];
}

type Plan = {
  score: number;
  threshold: number;
  now: number;
  /** Hour the user's hard time usually starts. */
  peak: number;
  /** When the last nudge was scheduled for, if any. */
  lastNudgeAt: number | null;
};

/**
 * When to send today's single nudge, or null for none: only on a harder day,
 * at most once a day, an hour before the usual hard time, never in quiet hours.
 */
export function planNudge({ score, threshold, now, peak, lastNudgeAt }: Plan): number | null {
  if (score < threshold) return null;
  if (lastNudgeAt !== null && localDay(lastNudgeAt) === localDay(now)) return null;

  const at = new Date(now);
  at.setHours(peak, 0, 0, 0);
  at.setTime(at.getTime() - LEAD_MINUTES * MINUTE);
  if (at.getHours() >= QUIET_START || localDay(+at) !== localDay(now)) return null;
  if (at.getHours() < QUIET_END) at.setHours(QUIET_END, 0, 0, 0);

  return at.getTime() - now >= MIN_NOTICE_MINUTES * MINUTE ? at.getTime() : null;
}
