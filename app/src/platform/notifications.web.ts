/**
 * Web demo stand-in: browsers get no scheduled reminders. Settings shows a
 * clearly labelled "Simulate notification" preview instead.
 */
import type { DailyReminder, OneTimeNudge } from './notifications';

export type { DailyReminder, OneTimeNudge };
export const REMINDER_ID = 'daily-checkin';
export const NUDGE_ID = 'early-warning';
export const CIRCLE_CHANNEL_ID = 'circle';

export async function requestNotificationPermission(): Promise<boolean> {
  return true;
}

export async function scheduleDailyReminder(_reminder: DailyReminder): Promise<void> {}

export async function cancelDailyReminder(): Promise<void> {}

export async function cancelAllScheduledNotifications(): Promise<void> {}

export async function scheduleNudge(_nudge: OneTimeNudge): Promise<void> {}

export async function cancelNudge(): Promise<void> {}
