import type { KeyStore } from '../platform/keyStore';
import { disableBiometricUnlock } from '../platform/biometrics';
import { cancelAllScheduledNotifications } from '../platform/notifications';
import { deleteDatabaseFile as deleteDbFile } from './db';
import { SECURE_KEYS } from './secureKeys';
import type { Database } from './types';

type Deps = {
  db: Database | null;
  store: KeyStore;
  deleteDatabaseFile?: () => Promise<void>;
  cancelNotifications?: () => Promise<void>;
  removeBiometricToken?: () => Promise<void>;
};

export type DeleteAllResult = { failed: string[] };

/**
 * Removes everything this app stores on the phone. Every step runs even if an
 * earlier one fails. The database key goes first: once it is gone, any
 * leftover database file is unreadable. If `dbKey` is in `failed`, the data
 * may still be readable and the user must be told to try again.
 * (Milestone 6 adds deleting the support-circle account.)
 */
export async function deleteAllData({
  db,
  store,
  deleteDatabaseFile = deleteDbFile,
  cancelNotifications = cancelAllScheduledNotifications,
  removeBiometricToken = disableBiometricUnlock,
}: Deps): Promise<DeleteAllResult> {
  const steps: [string, () => Promise<void>][] = [
    ['dbKey', () => retryOnce(() => store.remove(SECURE_KEYS.dbKey))],
    ['close', async () => db?.close()],
    ['database', deleteDatabaseFile],
    ['secureStore', () => removeAll(store)],
    ['biometrics', removeBiometricToken],
    ['notifications', cancelNotifications],
  ];

  const failed: string[] = [];
  for (const [name, step] of steps) {
    try {
      await step();
    } catch {
      failed.push(name);
    }
  }
  return { failed };
}

async function retryOnce(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    await action();
  }
}

async function removeAll(store: KeyStore): Promise<void> {
  const results = await Promise.allSettled(
    Object.values(SECURE_KEYS).map((key) => store.remove(key)),
  );
  if (results.some((r) => r.status === 'rejected')) throw new Error('secure store');
}
