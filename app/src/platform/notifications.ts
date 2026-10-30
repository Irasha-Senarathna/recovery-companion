import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

/** The single daily check-in reminder (scheduled on the phone, never via a server). */
export const REMINDER_ID = 'daily-checkin';
const CHANNEL_ID = 'reminders';

export type DailyReminder = {
  hour: number;
  minute: number;
  title: string;
  body: string;
  /** Shown in Android's notification settings. */
  channelName: string;
};

export async function requestNotificationPermission(): Promise<boolean> {
  // Only what a reminder needs: no badge.
  const result = await Notifications.requestPermissionsAsync({
    ios: { allowAlert: true, allowSound: true, allowBadge: false },
  });
  return result.granted;
}

export async function scheduleDailyReminder(reminder: DailyReminder): Promise<void> {
  // PRIVATE: on a secure lock screen Android shows only "Contents hidden".
  await Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: reminder.channelName,
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
  await cancelDailyReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: { title: reminder.title, body: reminder.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DAILY,
      hour: reminder.hour,
      minute: reminder.minute,
      channelId: CHANNEL_ID,
    },
  });
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
}

/**
 * Used by delete-all: future reminders, any already in the notification shade,
 * and the channel in Android settings. (M5's early-warning nudges go too.)
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  await Notifications.dismissAllNotificationsAsync();
  await Notifications.deleteNotificationChannelAsync(CHANNEL_ID);
}
