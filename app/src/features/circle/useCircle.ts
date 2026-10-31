import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  CircleError,
  type CircleClient,
  type CircleErrorKind,
  type CircleRole,
  type Credentials,
  type LinkInfo,
  type SignalInfo,
} from '../../net/circleClient';
import { forgetPushToken } from '../../platform/push';
import { secureStore } from '../../platform/secureStore';
import { useSession } from '../session/SessionProvider';
import { getLabels, keepOnlyLabels, removeAllLabels } from './circleRepo';
import { useCircleClient } from './client';
import { clearCredentials, deleteOrQueue, loadCredentials, saveCredentials } from './credentials';

export type CircleLink = LinkInfo & { label: string | null };
export type CirclePhase = 'loading' | 'unavailable' | 'off' | 'on';

export const kindOf = (error: unknown): CircleErrorKind =>
  error instanceof CircleError ? error.kind : 'server';

/** Server state for one role (member or supporter), merged with this phone's labels. */
export function useCircle(role: CircleRole) {
  const client = useCircleClient();
  const { db, updateSettings } = useSession();
  const [phase, setPhase] = useState<CirclePhase>('loading');
  const [links, setLinks] = useState<CircleLink[]>([]);
  const [signals, setSignals] = useState<SignalInfo[]>([]);
  const [error, setError] = useState<CircleErrorKind | null>(null);
  const [busy, setBusy] = useState(false);

  const forgetLocally = useCallback(async () => {
    await clearCredentials(secureStore, role);
    if (db) await removeAllLabels(db, role);
    if (role === 'supporter') {
      await forgetPushToken().catch(() => {});
      await updateSettings({ circleNotify: false });
    }
    setLinks([]);
    setSignals([]);
  }, [db, role, updateSettings]);

  const load = useCallback(async () => {
    if (!client || !db) return setPhase('unavailable');
    const creds = await loadCredentials(secureStore, role);
    if (!creds) return setPhase('off');
    setPhase('on');
    try {
      const fresh = await client.listLinks(creds.token);
      await keepOnlyLabels(
        db,
        role,
        fresh.map((link) => link.id),
      );
      const labels = await getLabels(db, role);
      setLinks(fresh.map((link) => ({ ...link, label: labels.get(link.id) ?? null })));
      if (role === 'supporter') setSignals(await client.listSignals(creds.token));
      setError(null);
    } catch (e) {
      // The server no longer knows this account (e.g. it was reset): start fresh.
      if (kindOf(e) === 'unauthorized') {
        await forgetLocally();
        return setPhase('off');
      }
      setError(kindOf(e));
    }
  }, [client, db, role, forgetLocally]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  /** This role's account, created on first use (only after the user asks for it). */
  const ensureAccount = useCallback(async (): Promise<Credentials | null> => {
    if (!client) return null;
    const saved = await loadCredentials(secureStore, role);
    if (saved) return saved;
    const created = await client.createAccount(role);
    await saveCredentials(secureStore, created);
    return created;
  }, [client, role]);

  /**
   * Runs a server action with this role's token, then reloads. Errors are shown
   * (or handed to `onError`), never thrown.
   */
  const run = useCallback(
    async <T>(
      action: (c: CircleClient, token: string) => Promise<T>,
      onError: (kind: CircleErrorKind) => void = setError,
    ): Promise<T | undefined> => {
      setBusy(true);
      setError(null);
      try {
        const creds = await ensureAccount();
        if (!client || !creds) return undefined;
        const result = await action(client, creds.token);
        await load();
        return result;
      } catch (e) {
        onError(kindOf(e));
        return undefined;
      } finally {
        setBusy(false);
      }
    },
    [client, ensureAccount, load],
  );

  const turnOn = useCallback(() => run(async () => {}), [run]);

  /** Deletes this role's server account (queued if offline) and everything local about it. */
  const leave = useCallback(async () => {
    setBusy(true);
    try {
      const creds = await loadCredentials(secureStore, role);
      const outcome = creds ? await deleteOrQueue(secureStore, client, creds.token) : 'deleted';
      await forgetLocally();
      setError(null);
      setPhase('off');
      return outcome;
    } finally {
      setBusy(false);
    }
  }, [client, role, forgetLocally]);

  return { phase, links, signals, error, busy, load, run, turnOn, leave, setError };
}

export type Circle = ReturnType<typeof useCircle>;
