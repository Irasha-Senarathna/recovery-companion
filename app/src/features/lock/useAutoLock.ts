import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';

export const AUTO_LOCK_MS = 60_000;

export function shouldLockAfterBackground(backgroundedAt: number | null, now: number): boolean {
  return backgroundedAt !== null && now - backgroundedAt >= AUTO_LOCK_MS;
}

type Options = { enabled: boolean; onLock: () => void; now?: () => number };

/** Locks the app when it returns after a minute or more in the background. */
export function useAutoLock({ enabled, onLock, now = Date.now }: Options): void {
  const backgroundedAt = useRef<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'background') {
        backgroundedAt.current = now();
      } else if (state === 'active') {
        if (shouldLockAfterBackground(backgroundedAt.current, now())) onLock();
        backgroundedAt.current = null;
      }
    });
    return () => subscription.remove();
  }, [enabled, onLock, now]);
}
