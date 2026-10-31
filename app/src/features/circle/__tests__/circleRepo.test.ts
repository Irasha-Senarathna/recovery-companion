import type { CircleClient } from '../../../net/circleClient';
import { CircleError } from '../../../net/circleClient';
import { createMemoryKeyStore } from '../../../platform/keyStore';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import { getLabels, keepOnlyLabels, MAX_LABEL_LENGTH, removeLabel, saveLabel } from '../circleRepo';
import {
  deleteCircleAccounts,
  flushQueuedDeletions,
  loadCredentials,
  PENDING_DELETE_KEY,
  saveCredentials,
} from '../credentials';

let db: Database;
beforeEach(async () => {
  db = await createTestDb();
});

const member = { accountId: 'm-1', token: 'tok-member', role: 'member' as const };
const supporter = { accountId: 's-1', token: 'tok-supporter', role: 'supporter' as const };

function fakeClient(deleteAccount: (token: string) => Promise<void>): CircleClient {
  return { deleteAccount: jest.fn(deleteAccount) } as unknown as CircleClient;
}

describe('local labels (they never leave this phone)', () => {
  it('saves, trims and reads labels per role', async () => {
    await saveLabel(db, 'member', 'l-1', '  Sister  ');
    await saveLabel(db, 'supporter', 'l-2', 'Ravi');
    expect(await getLabels(db, 'member')).toEqual(new Map([['l-1', 'Sister']]));
    expect(await getLabels(db, 'supporter')).toEqual(new Map([['l-2', 'Ravi']]));
  });

  it('caps label length', async () => {
    await saveLabel(db, 'member', 'l-1', 'x'.repeat(200));
    expect((await getLabels(db, 'member')).get('l-1')).toHaveLength(MAX_LABEL_LENGTH);
  });

  it('removes a label, and drops labels for links that are gone', async () => {
    await saveLabel(db, 'member', 'l-1', 'A');
    await saveLabel(db, 'member', 'l-2', 'B');
    await saveLabel(db, 'member', 'l-3', 'C');
    await removeLabel(db, 'l-1');
    await keepOnlyLabels(db, 'member', ['l-3']);
    expect(await getLabels(db, 'member')).toEqual(new Map([['l-3', 'C']]));
  });
});

describe('circle credentials', () => {
  it('are kept in the secure store, one account per role', async () => {
    const store = createMemoryKeyStore();
    await saveCredentials(store, member);
    expect(await loadCredentials(store, 'member')).toEqual(member);
    expect(await loadCredentials(store, 'supporter')).toBeNull();
  });
});

describe('deleting the server accounts', () => {
  it('deletes both accounts when online', async () => {
    const store = createMemoryKeyStore();
    await saveCredentials(store, member);
    await saveCredentials(store, supporter);
    const client = fakeClient(async () => {});

    expect(await deleteCircleAccounts(store, client)).toBe('deleted');
    expect(client.deleteAccount).toHaveBeenCalledWith('tok-member');
    expect(client.deleteAccount).toHaveBeenCalledWith('tok-supporter');
    expect(await store.get(PENDING_DELETE_KEY)).toBeNull();
  });

  it('does nothing when the circle was never turned on', async () => {
    const client = fakeClient(async () => {});
    expect(await deleteCircleAccounts(createMemoryKeyStore(), client)).toBe('none');
    expect(client.deleteAccount).not.toHaveBeenCalled();
  });

  it('queues the deletion when offline and retries it later', async () => {
    const store = createMemoryKeyStore();
    await saveCredentials(store, member);
    const offline = fakeClient(async () => {
      throw new CircleError('offline');
    });

    expect(await deleteCircleAccounts(store, offline)).toBe('queued');
    expect(JSON.parse((await store.get(PENDING_DELETE_KEY))!)).toEqual(['tok-member']);

    const online = fakeClient(async () => {});
    await flushQueuedDeletions(store, online);
    expect(online.deleteAccount).toHaveBeenCalledWith('tok-member');
    expect(await store.get(PENDING_DELETE_KEY)).toBeNull();
  });

  it('keeps what still fails in the queue', async () => {
    const store = createMemoryKeyStore();
    await store.set(PENDING_DELETE_KEY, JSON.stringify(['a', 'b']));
    const client = fakeClient(async (token) => {
      if (token === 'b') throw new CircleError('offline');
    });
    await flushQueuedDeletions(store, client);
    expect(JSON.parse((await store.get(PENDING_DELETE_KEY))!)).toEqual(['b']);
  });

  it('queues when no server is set up on this build', async () => {
    const store = createMemoryKeyStore();
    await saveCredentials(store, member);
    expect(await deleteCircleAccounts(store, null)).toBe('queued');
  });
});
