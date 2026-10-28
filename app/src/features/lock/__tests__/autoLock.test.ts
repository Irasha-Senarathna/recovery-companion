import { act, renderHook } from '@testing-library/react-native';
import { AppState, type AppStateStatus } from 'react-native';
import { AUTO_LOCK_MS, shouldLockAfterBackground, useAutoLock } from '../useAutoLock';

describe('shouldLockAfterBackground', () => {
  it('locks after one minute in the background', () => {
    expect(AUTO_LOCK_MS).toBe(60_000);
    expect(shouldLockAfterBackground(0, 59_999)).toBe(false);
    expect(shouldLockAfterBackground(0, 60_000)).toBe(true);
  });

  it('does nothing if the app never went to the background', () => {
    expect(shouldLockAfterBackground(null, 1_000_000)).toBe(false);
  });
});

describe('useAutoLock', () => {
  let emit: (state: AppStateStatus) => void;
  let now = 0;

  beforeEach(() => {
    now = 0;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, handler) => {
      emit = handler as (state: AppStateStatus) => void;
      return { remove: jest.fn() } as never;
    });
  });

  afterEach(() => jest.restoreAllMocks());

  async function setUp(enabled = true) {
    const onLock = jest.fn();
    await renderHook(() => useAutoLock({ enabled, onLock, now: () => now }));
    return onLock;
  }

  it('locks when the app comes back after a minute or more', async () => {
    const onLock = await setUp();
    await act(async () => emit('background'));
    now = 60_000;
    await act(async () => emit('active'));
    expect(onLock).toHaveBeenCalledTimes(1);
  });

  it('stays unlocked after a short switch to another app', async () => {
    const onLock = await setUp();
    await act(async () => emit('background'));
    now = 30_000;
    await act(async () => emit('active'));
    expect(onLock).not.toHaveBeenCalled();
  });

  it('does not lock when disabled (for example, before onboarding)', async () => {
    const onLock = await setUp(false);
    await act(async () => emit('background'));
    now = 120_000;
    await act(async () => emit('active'));
    expect(onLock).not.toHaveBeenCalled();
  });
});
