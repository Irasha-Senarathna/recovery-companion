/**
 * Web demo stand-in: browsers get no scheduled reminders. Settings shows a
 * clearly labelled "Simulate notification" preview instead.
 */
import type { DailyReminder } from './notifications';

export type { DailyReminder };
export const REMINDER_ID = 'daily-checkin';

export async function requestNotificationPermission(): Promise<boolean> {
  return true;
}

export async function scheduleDailyReminder(_reminder: DailyReminder): Promise<void> {}

export async function cancelDailyReminder(): Promise<void> {}

export async function cancelAllScheduledNotifications(): Promise<void> {}
