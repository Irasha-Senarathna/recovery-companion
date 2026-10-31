import path from 'path';
import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import i18n from '../../../i18n';
import { secureStore } from '../../../platform/secureStore';
import { openDatabase } from '../../../storage/db';
import { getOrCreateDbKey } from '../../../storage/key';
import { SECURE_KEYS } from '../../../storage/secureKeys';
import { setSetting } from '../../../storage/settings';
import * as fakeSqlite from '../../../test-utils/fakeExpoSqlite';
import { savePin } from '../../lock/pin';

const APP_DIR = path.join(__dirname, '..', '..', '..', 'app');
const sqlite = jest.requireMock('expo-sqlite') as typeof fakeSqlite;

// The real PIN hash is deliberately slow; keep these UI tests quick.
jest.mock('../../lock/pin', () => {
  const actual = jest.requireActual('../../lock/pin');
  return {
    ...actual,
    savePin: (store: unknown, pin: string) => actual.savePin(store, pin, { iterations: 1000 }),
  };
});

afterEach(async () => {
  await act(() => i18n.changeLanguage('en'));
});

async function seedReturningUser() {
  const db = await openDatabase(await getOrCreateDbKey(secureStore));
  await setSetting(db, 'nickname', 'Sky');
  await setSetting(db, 'language', 'en');
  await setSetting(db, 'onboarded', 'true');
  await db.close();
  await savePin(secureStore, '2468');
}

async function unlock(pin = '2468') {
  await fireEvent.changeText(await screen.findByTestId('pin-input'), pin);
  await fireEvent.press(screen.getByTestId('unlock'));
}

describe('first launch', () => {
  it('walks through language → disclaimer → nickname → PIN, then opens the app', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });

    await fireEvent.press(await screen.findByTestId('language-en'));
    await fireEvent.press(screen.getByTestId('onboarding-next'));

    expect(await screen.findByText(/does \*\*not\*\*|does not/i)).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('disclaimer-agree'));

    await fireEvent.changeText(await screen.findByTestId('nickname-input'), 'Sky');
    await fireEvent.press(screen.getByTestId('onboarding-next'));

    await fireEvent.changeText(await screen.findByTestId('pin-new'), '2468');
    await fireEvent.changeText(screen.getByTestId('pin-confirm'), '2468');
    await fireEvent.press(screen.getByTestId('onboarding-finish'));

    expect(await screen.findByText('Welcome, Sky')).toBeOnTheScreen();
    expect(await secureStore.get(SECURE_KEYS.dbKey)).toMatch(/^[0-9a-f]{64}$/);
    const record = JSON.parse((await secureStore.get(SECURE_KEYS.pin)) ?? '{}');
    expect(Object.values(record)).not.toContain('2468');
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
  }, 20_000); // renders the whole app; slow when the full suite runs in parallel

  it('rejects PINs that do not match', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('onboarding-next'));
    await fireEvent.press(await screen.findByTestId('disclaimer-agree'));
    await fireEvent.changeText(await screen.findByTestId('nickname-input'), 'Sky');
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    await fireEvent.changeText(await screen.findByTestId('pin-new'), '2468');
    await fireEvent.changeText(screen.getByTestId('pin-confirm'), '1357');
    await fireEvent.press(screen.getByTestId('onboarding-finish'));
    expect(await screen.findByText(/two PINs are different/i)).toBeOnTheScreen();
    expect(await secureStore.get(SECURE_KEYS.pin)).toBeNull();
  });

  it('rejects easy-to-guess PINs', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('onboarding-next'));
    await fireEvent.press(await screen.findByTestId('disclaimer-agree'));
    await fireEvent.changeText(await screen.findByTestId('nickname-input'), 'Sky');
    await fireEvent.press(screen.getByTestId('onboarding-next'));
    await fireEvent.changeText(await screen.findByTestId('pin-new'), '1111');
    await fireEvent.changeText(screen.getByTestId('pin-confirm'), '1111');
    await fireEvent.press(screen.getByTestId('onboarding-finish'));
    expect(await screen.findByText(/easy to guess/i)).toBeOnTheScreen();
    expect(await secureStore.get(SECURE_KEYS.pin)).toBeNull();
  });

  it('can reach help from onboarding and come back to the same step', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('help-button'));
    expect(await screen.findByTestId('help-screen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('help-back'));
    expect(await screen.findByTestId('language-en')).toBeOnTheScreen();
  });

  it('opens help straight away when crisis words are typed', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('onboarding-next'));
    await fireEvent.press(await screen.findByTestId('disclaimer-agree'));
    await fireEvent.changeText(await screen.findByTestId('nickname-input'), "I can't go on");
    expect(await screen.findByTestId('crisis-message')).toBeOnTheScreen();
  });
});

describe('returning user', () => {
  beforeEach(seedReturningUser);

  it('is locked on launch and unlocks with the right PIN', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    expect(await screen.findByTestId('pin-input')).toBeOnTheScreen();
    expect(screen.queryByText(/Sky/)).toBeNull();
    await unlock();
    expect(await screen.findByText('Welcome, Sky')).toBeOnTheScreen();
  });

  it('stays locked with a wrong PIN', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await unlock('1111');
    expect(await screen.findByText(/didn't match/i)).toBeOnTheScreen();
    expect(screen.queryByText('Welcome, Sky')).toBeNull();
  });

  it('can reach help from the lock screen', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('help-button'));
    expect(await screen.findByTestId('help-screen')).toBeOnTheScreen();
  });

  it('help from the hidden screen comes back to the hidden screen, not the app', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await unlock();
    await fireEvent.press(await screen.findByTestId('quick-hide'));
    await screen.findByTestId('hidden-screen');
    await fireEvent.press(screen.getByTestId('help-button'));
    expect(await screen.findByTestId('help-screen')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('help-back'));
    expect(await screen.findByTestId('hidden-screen')).toBeOnTheScreen();
    expect(screen.queryByText('Welcome, Sky')).toBeNull();
  });

  it('quick-hide switches to a neutral screen in one tap and needs the PIN to return', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await unlock();
    await fireEvent.press(await screen.findByTestId('quick-hide'));

    const hidden = await screen.findByTestId('hidden-screen');
    expect(hidden).toBeOnTheScreen();
    expect(screen.queryByText(/Sky/)).toBeNull();
    expect(screen.queryByText(/recovery/i)).toBeNull();

    await fireEvent(screen.getByTestId('hidden-return'), 'longPress');
    expect(await screen.findByTestId('pin-input')).toBeOnTheScreen();
  });

  it('delete-all removes everything and returns to onboarding', async () => {
    await renderRouter(APP_DIR, { initialUrl: '/' });
    await unlock();
    await fireEvent.press(await screen.findByTestId('open-settings'));
    await fireEvent.press(await screen.findByTestId('delete-all'));
    await fireEvent.press(screen.getByTestId('delete-all-confirm'));

    expect(await screen.findByTestId('onboarding-next')).toBeOnTheScreen();
    expect(await secureStore.get(SECURE_KEYS.pin)).toBeNull();
    await waitFor(async () => {
      // A brand-new key protects the brand-new, empty database.
      const newKey = await secureStore.get(SECURE_KEYS.dbKey);
      expect(sqlite.__fileKey('recovery.db')).toBe(newKey);
    });
  });
});
