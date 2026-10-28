import path from 'path';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { secureStore } from '../../../platform/secureStore';
import { openDatabase } from '../../../storage/db';
import { SECURE_KEYS } from '../../../storage/secureKeys';

const APP_DIR = path.join(__dirname, '..', '..', '..', 'app');

describe('storage problem', () => {
  it('can reach help from the problem screen', async () => {
    await (await openDatabase('a'.repeat(64))).close();
    await secureStore.set(SECURE_KEYS.dbKey, 'f'.repeat(64));
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await screen.findByText('Your data could not be opened');
    await fireEvent.press(screen.getByTestId('help-button'));
    expect(await screen.findByTestId('help-screen')).toBeOnTheScreen();
  });

  it('shows a reset option when the saved data cannot be opened', async () => {
    await (await openDatabase('a'.repeat(64))).close();
    await secureStore.set(SECURE_KEYS.dbKey, 'f'.repeat(64)); // key no longer matches
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByText('Your data could not be opened')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('delete-all'));
    await fireEvent.press(screen.getByTestId('delete-all-confirm'));
    expect(await screen.findByTestId('onboarding-next')).toBeOnTheScreen();
  });
});
