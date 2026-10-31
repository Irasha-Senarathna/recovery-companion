import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import appJson from '../../../../app.json';
import AboutRoute from '../../../app/about';
import SettingsRoute from '../../../app/settings';
import i18n from '../../../i18n';
import en from '../../../i18n/locales/en.json';
import { loadDisclaimer } from '../../onboarding/disclaimer';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';

function renderAbout(initialUrl = '/about') {
  return renderRouter(
    {
      _layout: layoutWithSession(fakeSession()),
      about: AboutRoute,
      settings: SettingsRoute,
    },
    { initialUrl },
  );
}

afterEach(() => i18n.changeLanguage('en'));

describe('about screen', () => {
  it('shows the user-verified disclaimer', async () => {
    await renderAbout();
    for (const block of loadDisclaimer()) {
      expect(await screen.findByText(block.text)).toBeOnTheScreen();
    }
  });

  it('sums up what stays on the phone and what can leave it', async () => {
    await renderAbout();
    const summary = await screen.findByTestId('about-privacy');
    expect(summary).toBeOnTheScreen();
    for (const point of Object.values(en.about.points)) {
      expect(screen.getByText(point)).toBeOnTheScreen();
    }
  });

  it('explains the neutral home-screen name', async () => {
    await renderAbout();
    expect(await screen.findByTestId('about-app-name')).toHaveTextContent(appJson.expo.name, {
      exact: false,
    });
  });

  it('shows the app version', async () => {
    await renderAbout();
    expect(await screen.findByTestId('about-version')).toHaveTextContent(appJson.expo.version, {
      exact: false,
    });
  });

  it('says the disclaimer is in English when another language is chosen', async () => {
    await i18n.changeLanguage('si');
    await renderAbout();
    expect(await screen.findByTestId('about-translation-note')).toBeOnTheScreen();
  });

  it('opens from settings', async () => {
    await renderAbout('/settings');
    await fireEvent.press(await screen.findByTestId('open-about'));
    expect(await screen.findByTestId('about-privacy')).toBeOnTheScreen();
  });
});
