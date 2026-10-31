import Constants from 'expo-constants';
import * as Notifications from 'expo-notifications';
import { AndroidImportance, AndroidNotificationVisibility } from 'expo-notifications';
import { CIRCLE_CHANNEL_ID, requestNotificationPermission } from './notifications';

/**
 * Supporter mode, only after the user turns notifications on: makes the
 * private channel and fetches this phone's Expo push token. Null if
 * permission is refused or push is not set up on this build (no FCM config).
 */
export async function getPushToken(channelName: string): Promise<string | null> {
  try {
    if (!(await requestNotificationPermission())) return null;
    await Notifications.setNotificationChannelAsync(CIRCLE_CHANNEL_ID, {
      name: channelName,
      importance: AndroidImportance.DEFAULT,
      lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
      showBadge: false,
    });
    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    const { data } = await Notifications.getExpoPushTokenAsync({ projectId });
    return data;
  } catch {
    return null;
  }
}

/** Turns push off on this phone: the token stops working and the channel goes. */
export async function forgetPushToken(): Promise<void> {
  const results = await Promise.allSettled([
    Notifications.unregisterForNotificationsAsync(),
    Notifications.deleteNotificationChannelAsync(CIRCLE_CHANNEL_ID),
  ]);
  if (results.some((r) => r.status === 'rejected')) throw new Error('push');
}
