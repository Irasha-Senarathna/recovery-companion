import type { TFunction } from 'i18next';
import { cancelDailyReminder, scheduleDailyReminder } from '../../platform/notifications';
import type { AppSettings } from '../../storage/settings';

export type ReminderTime = { hour: number; minute: number };
export type ReminderSettings = Pick<
  AppSettings,
  'reminderEnabled' | 'reminderHour' | 'reminderMinute'
>;

const DAY_MINUTES = 24 * 60;

/** Moves the time by `minutes`, wrapping around midnight. */
export function shiftTime({ hour, minute }: ReminderTime, minutes: number): ReminderTime {
  const total = (((hour * 60 + minute + minutes) % DAY_MINUTES) + DAY_MINUTES) % DAY_MINUTES;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

export function formatTime({ hour, minute }: ReminderTime): string {
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
}

/**
 * Makes the scheduled reminder match the settings, in the current language.
 * The text is neutral on purpose: it may show on a locked or shared phone.
 */
export async function syncReminder(settings: ReminderSettings, t: TFunction): Promise<void> {
  if (!settings.reminderEnabled) {
    await cancelDailyReminder();
    return;
  }
  await scheduleDailyReminder({
    hour: settings.reminderHour,
    minute: settings.reminderMinute,
    title: t('notifications.reminderTitle'),
    body: t('notifications.reminderBody'),
    channelName: t('notifications.channelName'),
  });
}
