import type { Exercise } from './exercises';
import type { SosSession } from './sosRepo';

/** A "usually" figure needs a few data points, or it reads like a promise. */
export const MIN_FOR_TYPICAL = 3;

export type SosStats = {
  /** Cravings the user said passed. */
  gotThrough: number;
  /** Median minutes from opening SOS to the craving passing; null with no data. */
  typicalMinutes: number | null;
};

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeStats(sessions: SosSession[]): SosStats {
  const minutes = sessions
    .filter((s) => s.outcome === 'passed' && s.endedAt !== null)
    .map((s) => ((s.endedAt as number) - s.startedAt) / 60_000);
  return {
    gotThrough: minutes.length,
    typicalMinutes:
      minutes.length >= MIN_FOR_TYPICAL ? Math.max(1, Math.round(median(minutes))) : null,
  };
}

/**
 * "Choose for me": the exercise that has helped most often. With no history,
 * a random one without breath-holding (holding can feel worse when anxious).
 */
export function pickExercise(
  sessions: SosSession[],
  exercises: Exercise[],
  random: () => number = Math.random,
): Exercise {
  const helped = new Map<string, number>();
  for (const s of sessions) {
    if (s.outcome === 'passed' && s.exerciseId) {
      helped.set(s.exerciseId, (helped.get(s.exerciseId) ?? 0) + 1);
    }
  }
  const best = [...helped.entries()].sort((a, b) => b[1] - a[1])[0];
  const favourite = best && exercises.find((e) => e.id === best[0]);
  if (favourite) return favourite;
  const gentle = exercises.filter((e) => !e.steps.some((s) => s.animation === 'hold'));
  const pool = gentle.length ? gentle : exercises;
  return pool[Math.floor(random() * pool.length)];
}
