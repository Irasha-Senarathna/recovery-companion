import { pbkdf2Async } from '@noble/hashes/pbkdf2.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { bytesToHex, hexToBytes, utf8ToBytes } from '@noble/hashes/utils.js';
import { getRandomBytesAsync } from 'expo-crypto';
import type { KeyStore } from '../../platform/keyStore';
import { SECURE_KEYS } from '../../storage/secureKeys';

export type PinRecord = { v: 1; salt: string; hash: string; iterations: number };
export type PinCheck =
  | { status: 'ok' }
  | { status: 'wrong' }
  | { status: 'wait'; retryAt: number }
  /** Too many failures: PIN entry stays off until biometric unlock or delete-all. */
  | { status: 'blocked' };
type Attempts = { failures: number; lastFailureAt: number };
type HashOptions = { iterations?: number };

/**
 * PBKDF2 runs in plain JavaScript, which is slow on phones (Hermes has no
 * JIT): 100k rounds took about a minute on a real device. 5k keeps setup and
 * unlock to about a second. The PIN guards against someone holding the phone:
 * the hash lives in the hardware-backed secure store and PIN entry stops after
 * MAX_TOTAL_FAILURES, so the round count is not what stops guessing.
 */
export const DEFAULT_ITERATIONS = 5_000;
/** A stored record with fewer rounds is damaged or tampered with: treat it as missing. */
const MIN_ITERATIONS = 1_000;
const SALT_BYTES = 16;
export const MAX_FREE_ATTEMPTS = 5;
/**
 * Hard ceiling. The wait between attempts uses the wall clock, which someone
 * holding the phone can move forward, so the total number of guesses is capped.
 */
export const MAX_TOTAL_FAILURES = 15;
const BASE_LOCKOUT_MS = 30_000;
const MAX_LOCKOUT_MS = 15 * 60_000;

export function isValidPin(pin: string): boolean {
  return /^\d{4,6}$/.test(pin);
}

// Common PINs, not phone numbers.
const COMMON_PINS = new Set(
  '1212 6969 2580 0852 1004 2000 1122 1313 4321'.split(' '), // not-a-phone-number
);

/** Same digit repeated, straight runs (1234, 9876) and very common PINs are guessed first. */
export function isWeakPin(pin: string): boolean {
  const digits = [...pin].map(Number);
  const steps = new Set(digits.slice(1).map((d, i) => d - digits[i]));
  const straight = steps.size === 1 && [0, 1, -1].includes([...steps][0]);
  return straight || COMMON_PINS.has(pin);
}

async function derive(pin: string, salt: Uint8Array, iterations: number): Promise<string> {
  const hash = await pbkdf2Async(sha256, utf8ToBytes(pin), salt, { c: iterations, dkLen: 32 });
  return bytesToHex(hash);
}

export async function createPinRecord(pin: string, options: HashOptions = {}): Promise<PinRecord> {
  const iterations = options.iterations ?? DEFAULT_ITERATIONS;
  const salt = await getRandomBytesAsync(SALT_BYTES);
  return { v: 1, salt: bytesToHex(salt), hash: await derive(pin, salt, iterations), iterations };
}

export async function verifyPin(pin: string, record: PinRecord | null): Promise<boolean> {
  if (!record) return false;
  const hash = await derive(pin, hexToBytes(record.salt), record.iterations);
  return constantTimeEqual(hash, record.hash);
}

function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

/** How long to wait after this many failed attempts in a row. */
export function lockoutMs(failures: number): number {
  if (failures < MAX_FREE_ATTEMPTS) return 0;
  return Math.min(BASE_LOCKOUT_MS * 2 ** (failures - MAX_FREE_ATTEMPTS), MAX_LOCKOUT_MS);
}

export async function savePin(store: KeyStore, pin: string, options?: HashOptions): Promise<void> {
  if (!isValidPin(pin)) throw new Error('Invalid PIN');
  await store.set(SECURE_KEYS.pin, JSON.stringify(await createPinRecord(pin, options)));
  await store.remove(SECURE_KEYS.pinAttempts);
}

export async function hasPin(store: KeyStore): Promise<boolean> {
  return (await store.get(SECURE_KEYS.pin)) !== null;
}

/** Checks a PIN, counting failures in the secure store so restarts don't reset them. */
export async function checkPin(store: KeyStore, pin: string, now = Date.now()): Promise<PinCheck> {
  const attempts = await loadAttempts(store);
  if (attempts.failures >= MAX_TOTAL_FAILURES) return { status: 'blocked' };

  // A clock moved backwards must not shorten the wait: restart it from now.
  const since = now < attempts.lastFailureAt ? now : attempts.lastFailureAt;
  const retryAt = since + lockoutMs(attempts.failures);
  if (now < retryAt) return { status: 'wait', retryAt };

  // Counted before the slow check, so closing the app mid-check still counts.
  const failures = attempts.failures + 1;
  await store.set(SECURE_KEYS.pinAttempts, JSON.stringify({ failures, lastFailureAt: now }));

  const record = await loadPinRecord(store);
  if (await verifyPin(pin, record)) {
    await store.remove(SECURE_KEYS.pinAttempts);
    // Re-save records made with older settings (e.g. the slow 100k rounds).
    if (record && record.iterations !== DEFAULT_ITERATIONS) await savePin(store, pin);
    return { status: 'ok' };
  }

  if (failures >= MAX_TOTAL_FAILURES) return { status: 'blocked' };
  const wait = lockoutMs(failures);
  return wait > 0 ? { status: 'wait', retryAt: now + wait } : { status: 'wrong' };
}

/** Called after a biometric unlock so earlier PIN failures don't linger. */
export async function resetAttempts(store: KeyStore): Promise<void> {
  await store.remove(SECURE_KEYS.pinAttempts);
}

async function loadPinRecord(store: KeyStore): Promise<PinRecord | null> {
  const record = parseJson(await store.get(SECURE_KEYS.pin));
  return isRecord(record) &&
    typeof record.salt === 'string' &&
    typeof record.hash === 'string' &&
    typeof record.iterations === 'number' &&
    record.iterations >= MIN_ITERATIONS
    ? (record as PinRecord)
    : null;
}

/** A missing counter means no failures; a corrupt one is treated as the worst case. */
async function loadAttempts(store: KeyStore): Promise<Attempts> {
  const raw = await store.get(SECURE_KEYS.pinAttempts);
  if (raw === null) return { failures: 0, lastFailureAt: 0 };
  const parsed = parseJson(raw);
  return isRecord(parsed) &&
    typeof parsed.failures === 'number' &&
    typeof parsed.lastFailureAt === 'number'
    ? (parsed as Attempts)
    : { failures: MAX_TOTAL_FAILURES, lastFailureAt: 0 };
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseJson(raw: string | null): unknown {
  try {
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}
