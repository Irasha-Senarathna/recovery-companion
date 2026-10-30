import { Slot } from 'expo-router';
import { DEFAULT_SETTINGS } from '../storage/settings';
import { SessionContext, type Session } from '../features/session/SessionProvider';

/** A session with no-op actions, for rendering single screens in tests. */
export function fakeSession(overrides: Partial<Session> = {}): Session {
  return {
    status: 'unlocked',
    hidden: false,
    settings: { ...DEFAULT_SETTINGS, nickname: 'Sky', onboarded: true },
    biometricsAvailable: false,
    db: null,
    unlockWithPin: jest.fn(async () => ({ status: 'ok' as const })),
    unlockWithBiometrics: jest.fn(async () => false),
    lock: jest.fn(),
    hide: jest.fn(),
    unhide: jest.fn(),
    completeOnboarding: jest.fn(async () => {}),
    updateSettings: jest.fn(async () => {}),
    deleteEverything: jest.fn(async () => ({ failed: [] })),
    ...overrides,
  };
}

/** A root layout that provides a fixed session instead of the real one. */
export function layoutWithSession(session: Session) {
  return function TestLayout() {
    return (
      <SessionContext.Provider value={session}>
        <Slot />
      </SessionContext.Provider>
    );
  };
}
