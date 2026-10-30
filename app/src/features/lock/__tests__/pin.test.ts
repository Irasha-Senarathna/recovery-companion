import { createMemoryKeyStore } from '../../../platform/keyStore';
import { SECURE_KEYS } from '../../../storage/secureKeys';
import {
  checkPin,
  createPinRecord,
  DEFAULT_ITERATIONS,
  hasPin,
  isValidPin,
  isWeakPin,
  lockoutMs,
  MAX_FREE_ATTEMPTS,
  MAX_TOTAL_FAILURES,
  savePin,
  verifyPin,
} from '../pin';

const FAST = { iterations: 1000 };

describe('isValidPin', () => {
  it.each(['1234', '12345', '123456'])('accepts %s', (pin) => {
    expect(isValidPin(pin)).toBe(true);
  });

  it.each(['', '123', '1234567', '12a4', ' 1234', '12.4'])('rejects %p', (pin) => {
    expect(isValidPin(pin)).toBe(false);
  });
});

describe('isWeakPin', () => {
  it.each(['0000', '1111', '1234', '9876', '123456', '4321', '1212', '2580'])('flags %s', (pin) => {
    expect(isWeakPin(pin)).toBe(true);
  });

  it.each(['2468', '7351', '903817'])('accepts %s', (pin) => {
    expect(isWeakPin(pin)).toBe(false);
  });
});

describe('PIN hashing', () => {
  it('stores a salted hash, never the PIN itself', async () => {
    const record = await createPinRecord('2468', FAST);
    // Random hex can contain "2468" by chance, so check no field *is* the PIN.
    expect(Object.values(record)).not.toContain('2468');
    expect(record.salt).toMatch(/^[0-9a-f]{32}$/);
    expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(record.iterations).toBe(1000);
  });

  it('uses a new salt every time', async () => {
    const a = await createPinRecord('2468', FAST);
    const b = await createPinRecord('2468', FAST);
    expect(a.salt).not.toBe(b.salt);
    expect(a.hash).not.toBe(b.hash);
  });

  it('uses a key-derivation function with thousands of rounds by default', async () => {
    const record = await createPinRecord('2468');
    expect(record.iterations).toBe(DEFAULT_ITERATIONS);
    expect(record.iterations).toBeGreaterThanOrEqual(5_000);
  });

  it('upgrades a PIN saved with old settings after a successful unlock', async () => {
    const store = createMemoryKeyStore();
    await savePin(store, '2468', { iterations: 1000 });
    expect(await checkPin(store, '2468', 0)).toEqual({ status: 'ok' });
    const record = JSON.parse((await store.get(SECURE_KEYS.pin)) ?? '{}');
    expect(record.iterations).toBe(DEFAULT_ITERATIONS);
    expect(await checkPin(store, '2468', 0)).toEqual({ status: 'ok' });
  });

  it('verifies the right PIN and rejects a wrong one', async () => {
    const record = await createPinRecord('2468', FAST);
    expect(await verifyPin('2468', record)).toBe(true);
    expect(await verifyPin('2469', record)).toBe(false);
  });
});

describe('saved PIN and attempt limits', () => {
  it('saves only the hash record in the secure store', async () => {
    const store = createMemoryKeyStore();
    expect(await hasPin(store)).toBe(false);
    await savePin(store, '2468', FAST);
    expect(await hasPin(store)).toBe(true);
    expect(Object.values(JSON.parse((await store.get(SECURE_KEYS.pin)) ?? '{}'))).not.toContain(
      '2468',
    );
  });

  it('unlocks with the right PIN', async () => {
    const store = createMemoryKeyStore();
    await savePin(store, '2468', FAST);
    expect(await checkPin(store, '2468', 0)).toEqual({ status: 'ok' });
  });

  it('makes the user wait after too many wrong PINs, then resets after success', async () => {
    const store = createMemoryKeyStore();
    await savePin(store, '2468', FAST);
    let now = 1_000_000;

    for (let i = 0; i < MAX_FREE_ATTEMPTS - 1; i++) {
      expect(await checkPin(store, '0000', now)).toEqual({ status: 'wrong' });
    }
    const last = await checkPin(store, '0000', now);
    expect(last).toEqual({ status: 'wait', retryAt: now + lockoutMs(MAX_FREE_ATTEMPTS) });

    // Even the right PIN is not checked while waiting.
    expect(await checkPin(store, '2468', now + 1000)).toMatchObject({ status: 'wait' });

    now += lockoutMs(MAX_FREE_ATTEMPTS);
    expect(await checkPin(store, '2468', now)).toEqual({ status: 'ok' });
    expect(await checkPin(store, '0000', now)).toEqual({ status: 'wrong' });
  });

  it('remembers failed attempts across app restarts (stored, not in memory)', async () => {
    const store = createMemoryKeyStore();
    await savePin(store, '2468', FAST);
    for (let i = 0; i < MAX_FREE_ATTEMPTS; i++) await checkPin(store, '0000', 0);
    expect(await store.get(SECURE_KEYS.pinAttempts)).not.toBeNull();
  });
});

describe('clock tampering and corrupt state', () => {
  async function failUntilBlocked(store: ReturnType<typeof createMemoryKeyStore>) {
    // Each attempt waits out the lockout by moving "now" forward, as someone
    // changing the phone's clock could.
    let now = 0;
    let result;
    for (let i = 0; i < MAX_TOTAL_FAILURES; i++) {
      now += 60 * 60_000;
      result = await checkPin(store, '0000', now);
    }
    return { result, now };
  }

  it('caps the total number of guesses even if the clock is moved forward', async () => {
    const store = createMemoryKeyStore();
    await savePin(store, '2468', FAST);
    const { result, now } = await failUntilBlocked(store);
    expect(result).toEqual({ status: 'blocked' });
    // Even the right PIN no longer works: only biometrics or delete-all.
    expect(await checkPin(store, '2468', now + 24 * 60 * 60_000)).toEqual({ status: 'blocked' });
  });

  it('does not shorten the wait when the clock is moved backwards', async () => {
    const store = createMemoryKeyStore();
    await savePin(store, '2468', FAST);
    const start = 10_000_000;
    for (let i = 0; i < MAX_FREE_ATTEMPTS; i++) await checkPin(store, '0000', start);
    const earlier = start - 60 * 60_000;
    expect(await checkPin(store, '2468', earlier)).toEqual({
      status: 'wait',
      retryAt: earlier + lockoutMs(MAX_FREE_ATTEMPTS),
    });
  });

  it('treats a corrupt attempt counter as the worst case', async () => {
    const store = createMemoryKeyStore();
    await savePin(store, '2468', FAST);
    await store.set(SECURE_KEYS.pinAttempts, '{not json');
    expect(await checkPin(store, '2468', 0)).toEqual({ status: 'blocked' });
  });

  it('rejects every PIN if the PIN record is corrupt (no crash)', async () => {
    const store = createMemoryKeyStore();
    await store.set(SECURE_KEYS.pin, 'garbage');
    expect(await checkPin(store, '2468', 0)).toEqual({ status: 'wrong' });
  });
});

describe('lockoutMs', () => {
  it('is free for the first attempts, then doubles up to a cap', () => {
    expect(lockoutMs(MAX_FREE_ATTEMPTS - 1)).toBe(0);
    expect(lockoutMs(MAX_FREE_ATTEMPTS)).toBe(30_000);
    expect(lockoutMs(MAX_FREE_ATTEMPTS + 1)).toBe(60_000);
    expect(lockoutMs(MAX_FREE_ATTEMPTS + 20)).toBe(15 * 60_000);
  });
});
