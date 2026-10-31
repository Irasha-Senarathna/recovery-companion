import type { KeyStore } from '../../platform/keyStore';
import { defaultCircleClient } from '../circle/client';
import { flushQueuedDeletions } from '../circle/credentials';
import { clearMediaTemp } from '../../platform/mediaTemp';
import { openDatabase } from '../../storage/db';
import { getOrCreateDbKey } from '../../storage/key';
import { DEFAULT_SETTINGS, loadSettings, type AppSettings } from '../../storage/settings';
import type { Database } from '../../storage/types';
import { hasPin } from '../lock/pin';

export type BootResult =
  | { status: 'onboarding' | 'locked'; db: Database; settings: AppSettings }
  | { status: 'error'; db: null; settings: AppSettings };

/** Opens the encrypted store and decides where the app starts. */
export async function boot(store: KeyStore): Promise<BootResult> {
  // Leftover unencrypted media from a crash or a lock mid-recording.
  await clearMediaTemp().catch(() => {});
  // Support-circle accounts whose deletion was queued while offline (not awaited).
  flushQueuedDeletions(store, defaultCircleClient()).catch(() => {});
  try {
    const db = await openDatabase(await getOrCreateDbKey(store));
    const settings = await loadSettings(db);
    const ready = settings.onboarded && (await hasPin(store));
    return { status: ready ? 'locked' : 'onboarding', db, settings };
  } catch {
    // No details are logged: error messages could include personal data.
    return { status: 'error', db: null, settings: DEFAULT_SETTINGS };
  }
}
