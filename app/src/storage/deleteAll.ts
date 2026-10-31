import { leaveCircleEverywhere } from '../features/circle/credentials';
import type { KeyStore } from '../platform/keyStore';
import { disableBiometricUnlock } from '../platform/biometrics';
import { cancelAllScheduledNotifications } from '../platform/notifications';
import { clearMediaTemp } from '../platform/mediaTemp';
import { stopVoice } from '../platform/voice';
import { deleteDatabaseFile as deleteDbFile } from './db';
import { SECURE_KEYS } from './secureKeys';
import type { Database } from './types';

type Deps = {
  db: Database | null;
  store: KeyStore;
  deleteDatabaseFile?: () => Promise<void>;
  cancelNotifications?: () => Promise<void>;
  removeBiometricToken?: () => Promise<void>;
  clearTempFiles?: () => Promise<void>;
  leaveCircle?: (store: KeyStore) => Promise<'none' | 'deleted' | 'queued'>;
};

/** `circleQueued`: the server was out of reach; its account is deleted at a later launch. */
export type DeleteAllResult = { failed: string[]; circleQueued?: boolean };

/**
 * Removes everything this app stores on the phone. Every step runs even if an
 * earlier one fails. The database key goes first: once it is gone, any
 * leftover database file is unreadable. If `dbKey` is in `failed`, the data
 * may still be readable and the user must be told to try again.
 * Support-circle accounts are deleted on the server before their tokens go.
 */
export async function deleteAllData({
  db,
  store,
  deleteDatabaseFile = deleteDbFile,
  cancelNotifications = cancelAllScheduledNotifications,
  removeBiometricToken = disableBiometricUnlock,
  clearTempFiles = clearMediaTemp,
  leaveCircle = leaveCircleEverywhere,
}: Deps): Promise<DeleteAllResult> {
  let circleQueued = false;
  const failed: string[] = [];
  const steps: [string, () => Promise<void>][] = [
    ['dbKey', () => retryOnce(() => store.remove(SECURE_KEYS.dbKey))],
    ['playback', async () => stopVoice()],
    ['close', async () => db?.close()],
    ['database', deleteDatabaseFile],
    // Needs the circle tokens, so it runs before the secure store is cleared.
    [
      'circle',
      async () => {
        circleQueued = (await leaveCircle(store)) === 'queued';
      },
    ],
    // If the server step failed, its tokens stay so delete-all can be tried again.
    ['secureStore', () => removeAll(store, failed.includes('circle') ? CIRCLE_KEYS : [])],
    ['biometrics', removeBiometricToken],
    ['notifications', cancelNotifications],
    ['tempFiles', clearTempFiles],
  ];

  for (const [name, step] of steps) {
    try {
      await step();
    } catch {
      failed.push(name);
    }
  }
  return circleQueued ? { failed, circleQueued } : { failed };
}

async function retryOnce(action: () => Promise<void>): Promise<void> {
  try {
    await action();
  } catch {
    await action();
  }
}

const CIRCLE_KEYS: string[] = [SECURE_KEYS.circleMember, SECURE_KEYS.circleSupporter];

async function removeAll(store: KeyStore, keep: string[]): Promise<void> {
  const keys = Object.values(SECURE_KEYS).filter((key) => !keep.includes(key));
  const results = await Promise.allSettled(keys.map((key) => store.remove(key)));
  if (results.some((r) => r.status === 'rejected')) throw new Error('secure store');
}
