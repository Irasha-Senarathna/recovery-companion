import path from 'path';
import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import i18n from '../i18n';

const APP_DIR = path.join(__dirname, '..', 'app');

afterEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

describe('language switcher', () => {
  it.each([
    ['si', 'language-si'],
    ['ta', 'language-ta'],
    ['en', 'language-en'],
  ])('switches the app to %s', async (lang, testId) => {
    await renderRouter(APP_DIR, { initialUrl: '/settings' });
    await fireEvent.press(await screen.findByTestId(testId));
    expect(i18n.language).toBe(lang);
    expect(screen.getByTestId(testId).props.accessibilityState).toMatchObject({
      selected: true,
    });
  });
});
