import { Accelerometer } from 'expo-sensors';
import { useEffect } from 'react';
import { Platform } from 'react-native';

type Measurement = { x: number; y: number; z: number; timestamp: number };
type Options = { thresholdG?: number; hits?: number; windowS?: number };

/**
 * Returns a function that is fed accelerometer readings (in g, timestamp in
 * seconds) and returns true once per shake: `hits` strong jolts within
 * `windowS`. After firing it ignores readings for one window.
 */
export function createShakeDetector({ thresholdG = 2.2, hits = 3, windowS = 1 }: Options = {}) {
  let jolts: number[] = [];
  let quietUntil = -Infinity;

  return ({ x, y, z, timestamp }: Measurement): boolean => {
    if (timestamp < quietUntil) return false;
    if (Math.sqrt(x * x + y * y + z * z) < thresholdG) return false;

    jolts = [...jolts.filter((t) => timestamp - t <= windowS), timestamp];
    if (jolts.length < hits) return false;

    jolts = [];
    quietUntil = timestamp + windowS;
    return true;
  };
}

type HookOptions = { enabled: boolean; onShake: () => void };

/** Optional shake-to-hide. Phone only: the web demo uses the Hide button. */
export function useShakeToHide({ enabled, onShake }: HookOptions): void {
  useEffect(() => {
    if (!enabled || Platform.OS === 'web') return;
    let active = true;
    let subscription: { remove: () => void } | null = null;

    Accelerometer.isAvailableAsync().then((available) => {
      if (!available || !active) return;
      const detect = createShakeDetector();
      Accelerometer.setUpdateInterval(100);
      subscription = Accelerometer.addListener((m) => {
        if (detect(m)) onShake();
      });
    });

    return () => {
      active = false;
      subscription?.remove();
    };
  }, [enabled, onShake]);
}
