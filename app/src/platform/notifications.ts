import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';

/** The single daily check-in reminder (scheduled on the phone, never via a server). */
export const REMINDER_ID = 'daily-checkin';
const CHANNEL_ID = 'reminders';
/** The single early-warning heads-up (M5). */
export const NUDGE_ID = 'early-warning';
const NUDGE_CHANNEL_ID = 'nudges';
/** Support-circle pushes (M6, supporter mode). Must match server/app/push.py. */
export const CIRCLE_CHANNEL_ID = 'circle';

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

export type OneTimeNudge = { at: number; title: string; body: string; channelName: string };

export async function scheduleNudge(nudge: OneTimeNudge): Promise<void> {
  await Notifications.setNotificationChannelAsync(NUDGE_CHANNEL_ID, {
    name: nudge.channelName,
    importance: AndroidImportance.DEFAULT,
    lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
    showBadge: false,
  });
  await cancelNudge();
  await Notifications.scheduleNotificationAsync({
    identifier: NUDGE_ID,
    content: { title: nudge.title, body: nudge.body },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.DATE,
      date: nudge.at,
      channelId: NUDGE_CHANNEL_ID,
    },
  });
}

/** Cancels a pending heads-up and removes one already in the notification shade. */
export async function cancelNudge(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(NUDGE_ID);
  await Notifications.dismissNotificationAsync(NUDGE_ID);
}

export async function cancelDailyReminder(): Promise<void> {
  await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
}

/**
 * Used by delete-all: future reminders, any already in the notification shade,
 * and every channel in Android settings (reminder, heads-up, support circle).
 */
export async function cancelAllScheduledNotifications(): Promise<void> {
  // Every step runs even if one fails, so no channel is left behind.
  const results = await Promise.allSettled([
    Notifications.cancelAllScheduledNotificationsAsync(),
    Notifications.dismissAllNotificationsAsync(),
    Notifications.deleteNotificationChannelAsync(CHANNEL_ID),
    Notifications.deleteNotificationChannelAsync(NUDGE_CHANNEL_ID),
    Notifications.deleteNotificationChannelAsync(CIRCLE_CHANNEL_ID),
  ]);
  if (results.some((r) => r.status === 'rejected')) throw new Error('notifications');
}
