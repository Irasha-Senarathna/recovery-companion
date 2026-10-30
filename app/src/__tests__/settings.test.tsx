import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as LocalAuthentication from 'expo-local-authentication';
import i18n from '../i18n';
import { DEFAULT_SETTINGS } from '../storage/settings';
import SettingsScreen from '../app/settings';
import { fakeSession, layoutWithSession } from '../test-utils/session';

afterEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

function renderSettings(session = fakeSession()) {
  return renderRouter(
    { _layout: layoutWithSession(session), settings: SettingsScreen },
    { initialUrl: '/settings' },
  );
}

describe('language switcher', () => {
  it.each([
    ['si', 'language-si'],
    ['ta', 'language-ta'],
    ['en', 'language-en'],
  ])('switches the app to %s and saves it', async (lang, testId) => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent.press(await screen.findByTestId(testId));
    expect(i18n.language).toBe(lang);
    expect(session.updateSettings).toHaveBeenCalledWith({ language: lang });
    expect(screen.getByTestId(testId).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});

describe('security settings', () => {
  it('turns shake-to-hide on', async () => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent(await screen.findByTestId('shake-to-hide'), 'valueChange', true);
    expect(session.updateSettings).toHaveBeenCalledWith({ shakeToHide: true });
  });

  it('offers fingerprint unlock only when the device supports it', async () => {
    await renderSettings(fakeSession({ biometricsAvailable: false }));
    expect(screen.queryByTestId('biometric-unlock')).toBeNull();
  });

  it('asks for the fingerprint before turning fingerprint unlock on', async () => {
    jest.mocked(LocalAuthentication.authenticateAsync).mockResolvedValueOnce({ success: true });
    const session = fakeSession({ biometricsAvailable: true });
    await renderSettings(session);
    await fireEvent(await screen.findByTestId('biometric-unlock'), 'valueChange', true);
    expect(LocalAuthentication.authenticateAsync).toHaveBeenCalled();
    expect(session.updateSettings).toHaveBeenCalledWith({ biometricEnabled: true });
  });
});

describe('support person', () => {
  it('saves a name and phone number for "Call my support person"', async () => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent.changeText(await screen.findByTestId('support-name'), 'Amma');
    await fireEvent.changeText(screen.getByTestId('support-phone'), '+94 77 000 0000');
    await fireEvent.press(screen.getByTestId('support-save'));
    expect(session.updateSettings).toHaveBeenCalledWith({
      supportName: 'Amma',
      supportPhone: '+94770000000',
    });
  });

  it('can remove the support person', async () => {
    const session = fakeSession({
      settings: { ...DEFAULT_SETTINGS, supportName: 'Amma', supportPhone: '+94770000000' },
    });
    await renderSettings(session);
    await fireEvent.press(await screen.findByTestId('support-remove'));
    expect(session.updateSettings).toHaveBeenCalledWith({ supportName: null, supportPhone: null });
  });

  it('rejects a number that is too short to be real', async () => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent.changeText(await screen.findByTestId('support-name'), 'Amma');
    await fireEvent.changeText(screen.getByTestId('support-phone'), '123');
    await fireEvent.press(screen.getByTestId('support-save'));
    expect(session.updateSettings).not.toHaveBeenCalled();
  });

  it('rejects a phone number without enough digits', async () => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent.changeText(await screen.findByTestId('support-name'), 'Amma');
    await fireEvent.changeText(screen.getByTestId('support-phone'), 'abc');
    await fireEvent.press(screen.getByTestId('support-save'));
    expect(session.updateSettings).not.toHaveBeenCalled();
  });
});

describe('delete all my data', () => {
  it('asks for confirmation, then deletes everything (2 taps)', async () => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent.press(await screen.findByTestId('delete-all'));
    expect(session.deleteEverything).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('delete-all-confirm'));
    expect(session.deleteEverything).toHaveBeenCalledTimes(1);
  });

  it('can be cancelled', async () => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent.press(await screen.findByTestId('delete-all'));
    await fireEvent.press(screen.getByTestId('delete-all-cancel'));
    expect(screen.queryByTestId('delete-all-confirm')).toBeNull();
    expect(session.deleteEverything).not.toHaveBeenCalled();
  });
});

describe('daily check-in reminder', () => {
  const Notifications = jest.requireMock('expo-notifications');

  beforeEach(() => jest.clearAllMocks());

  it('asks for permission, then turns the reminder on and schedules it', async () => {
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent(await screen.findByTestId('reminder-enabled'), 'valueChange', true);
    expect(Notifications.requestPermissionsAsync).toHaveBeenCalled();
    expect(session.updateSettings).toHaveBeenCalledWith({ reminderEnabled: true });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalled();
  });

  it('stays off and explains when notifications are not allowed', async () => {
    Notifications.requestPermissionsAsync.mockResolvedValueOnce({ granted: false });
    const session = fakeSession();
    await renderSettings(session);
    await fireEvent(await screen.findByTestId('reminder-enabled'), 'valueChange', true);
    expect(session.updateSettings).not.toHaveBeenCalled();
    expect(await screen.findByTestId('reminder-denied')).toBeOnTheScreen();
  });

  it('moves the time and reschedules', async () => {
    const settings = { ...DEFAULT_SETTINGS, reminderEnabled: true };
    const session = fakeSession({ settings });
    await renderSettings(session);
    expect(await screen.findByText('20:00')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('reminder-later'));
    expect(session.updateSettings).toHaveBeenCalledWith({ reminderHour: 20, reminderMinute: 15 });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({ trigger: expect.objectContaining({ hour: 20, minute: 15 }) }),
    );
  });

  it('shows exactly what the reminder will say', async () => {
    await renderSettings(fakeSession({ settings: { ...DEFAULT_SETTINGS, reminderEnabled: true } }));
    expect(await screen.findByText(i18n.t('notifications.reminderBody'))).toBeOnTheScreen();
  });
});
