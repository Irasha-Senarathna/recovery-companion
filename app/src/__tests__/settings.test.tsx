import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as LocalAuthentication from 'expo-local-authentication';
import i18n from '../i18n';
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
