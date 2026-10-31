import type { CircleClient, CircleRole, Credentials } from '../../net/circleClient';
import type { KeyStore } from '../../platform/keyStore';
import { forgetPushToken } from '../../platform/push';
import { SECURE_KEYS } from '../../storage/secureKeys';
import { defaultCircleClient } from './client';

const KEYS: Record<CircleRole, string> = {
  member: SECURE_KEYS.circleMember,
  supporter: SECURE_KEYS.circleSupporter,
};

/**
 * Tokens of server accounts still to be deleted (delete-all or leaving while
 * offline). On purpose NOT in SECURE_KEYS, so it outlives delete-all until the
 * server confirms. It holds only random tokens, nothing personal.
 */
export const PENDING_DELETE_KEY = 'rc.circle_pending_delete';

export async function loadCredentials(
  store: KeyStore,
  role: CircleRole,
): Promise<Credentials | null> {
  const raw = await store.get(KEYS[role]);
  if (!raw) return null;
  try {
    const { accountId, token } = JSON.parse(raw) as Partial<Credentials>;
    return typeof accountId === 'string' && typeof token === 'string'
      ? { accountId, token, role }
      : null;
  } catch {
    return null;
  }
}

export async function saveCredentials(store: KeyStore, creds: Credentials): Promise<void> {
  const { accountId, token } = creds;
  await store.set(KEYS[creds.role], JSON.stringify({ accountId, token }));
}

export async function clearCredentials(store: KeyStore, role: CircleRole): Promise<void> {
  await store.remove(KEYS[role]);
}

async function readQueue(store: KeyStore): Promise<string[]> {
  try {
    const parsed: unknown = JSON.parse((await store.get(PENDING_DELETE_KEY)) ?? '[]');
    return Array.isArray(parsed) ? parsed.filter((t): t is string => typeof t === 'string') : [];
  } catch {
    return [];
  }
}

async function writeQueue(store: KeyStore, tokens: string[]): Promise<void> {
  if (tokens.length === 0) await store.remove(PENDING_DELETE_KEY);
  else await store.set(PENDING_DELETE_KEY, JSON.stringify([...new Set(tokens)]));
}

/** Deletes one server account now, or queues it if the server cannot be reached. */
export async function deleteOrQueue(
  store: KeyStore,
  client: CircleClient | null,
  token: string,
): Promise<'deleted' | 'queued'> {
  try {
    if (!client) throw new Error('no server on this build');
    await client.deleteAccount(token);
    return 'deleted';
  } catch {
    await writeQueue(store, [...(await readQueue(store)), token]);
    return 'queued';
  }
}

/** Delete-all: removes this phone's member and supporter accounts from the server. */
export async function deleteCircleAccounts(
  store: KeyStore,
  client: CircleClient | null,
): Promise<'none' | 'deleted' | 'queued'> {
  let outcome: 'none' | 'deleted' | 'queued' = 'none';
  for (const role of ['member', 'supporter'] as const) {
    const creds = await loadCredentials(store, role);
    if (!creds) continue;
    const result = await deleteOrQueue(store, client, creds.token);
    if (outcome !== 'queued') outcome = result;
  }
  return outcome;
}

/** Retries queued deletions (at launch). Whatever still fails stays queued. */
export async function flushQueuedDeletions(
  store: KeyStore,
  client: CircleClient | null,
): Promise<void> {
  const queued = await readQueue(store);
  if (!client || queued.length === 0) return;
  const left: string[] = [];
  for (const token of queued) {
    await client.deleteAccount(token).catch(() => left.push(token));
  }
  await writeQueue(store, left);
}

/** Delete-all's circle step: server accounts, then this phone's push token. */
export async function leaveCircleEverywhere(
  store: KeyStore,
  client: CircleClient | null = defaultCircleClient(),
): Promise<'none' | 'deleted' | 'queued'> {
  const outcome = await deleteCircleAccounts(store, client);
  if (outcome !== 'none') await forgetPushToken().catch(() => {});
  return outcome;
}
