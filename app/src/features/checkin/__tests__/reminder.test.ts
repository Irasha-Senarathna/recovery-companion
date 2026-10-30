import * as Notifications from 'expo-notifications';
import { AndroidNotificationVisibility } from 'expo-notifications';
import i18n from '../../../i18n';
import { cancelAllScheduledNotifications, REMINDER_ID } from '../../../platform/notifications';
import { formatTime, shiftTime, syncReminder } from '../reminder';

const mocked = jest.mocked(Notifications);

beforeEach(() => {
  jest.clearAllMocks();
  i18n.changeLanguage('en');
});

describe('reminder time', () => {
  it('moves in steps and wraps around midnight', () => {
    expect(shiftTime({ hour: 20, minute: 0 }, 15)).toEqual({ hour: 20, minute: 15 });
    expect(shiftTime({ hour: 23, minute: 45 }, 15)).toEqual({ hour: 0, minute: 0 });
    expect(shiftTime({ hour: 0, minute: 0 }, -60)).toEqual({ hour: 23, minute: 0 });
  });

  it('formats as HH:MM', () => {
    expect(formatTime({ hour: 7, minute: 5 })).toBe('07:05');
  });
});

describe('syncReminder', () => {
  it('schedules one daily reminder at the chosen time with neutral, private text', async () => {
    await syncReminder({ reminderEnabled: true, reminderHour: 20, reminderMinute: 30 }, i18n.t);

    expect(mocked.setNotificationChannelAsync).toHaveBeenCalledWith(
      'reminders',
      expect.objectContaining({
        lockscreenVisibility: AndroidNotificationVisibility.PRIVATE,
      }),
    );
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
    expect(mocked.scheduleNotificationAsync).toHaveBeenCalledWith({
      identifier: REMINDER_ID,
      content: {
        title: i18n.t('notifications.reminderTitle'),
        body: i18n.t('notifications.reminderBody'),
      },
      trigger: expect.objectContaining({
        type: Notifications.SchedulableTriggerInputTypes.DAILY,
        hour: 20,
        minute: 30,
        channelId: 'reminders',
      }),
    });
  });

  it('uses the current language', async () => {
    await i18n.changeLanguage('ta');
    await syncReminder({ reminderEnabled: true, reminderHour: 8, reminderMinute: 0 }, i18n.t);
    const request = mocked.scheduleNotificationAsync.mock.calls[0][0];
    expect(request.content.title).toBe(i18n.t('notifications.reminderTitle'));
    expect(request.content.title).not.toBe(i18n.t('notifications.reminderTitle', { lng: 'en' }));
  });

  it('only cancels when the reminder is off', async () => {
    await syncReminder({ reminderEnabled: false, reminderHour: 20, reminderMinute: 0 }, i18n.t);
    expect(mocked.cancelScheduledNotificationAsync).toHaveBeenCalledWith(REMINDER_ID);
    expect(mocked.scheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('delete-all cancels every scheduled notification', async () => {
    await cancelAllScheduledNotifications();
    expect(mocked.cancelAllScheduledNotificationsAsync).toHaveBeenCalled();
    expect(mocked.dismissAllNotificationsAsync).toHaveBeenCalled();
    expect(mocked.deleteNotificationChannelAsync).toHaveBeenCalledWith('reminders');
    expect(mocked.deleteNotificationChannelAsync).toHaveBeenCalledWith('nudges');
  });

  it('delete-all still removes both channels when an earlier step fails', async () => {
    mocked.cancelAllScheduledNotificationsAsync.mockRejectedValueOnce(new Error('x'));
    await expect(cancelAllScheduledNotifications()).rejects.toThrow();
    expect(mocked.deleteNotificationChannelAsync).toHaveBeenCalledWith('nudges');
  });
});
