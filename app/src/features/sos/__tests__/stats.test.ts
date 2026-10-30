import { EXERCISES } from '../exercises';
import type { SosSession } from '../sosRepo';
import { computeStats, pickExercise } from '../stats';

const MIN = 60_000;
let nextId = 1;
const session = (
  minutes: number | null,
  outcome: SosSession['outcome'],
  exerciseId = 'box-breathing',
) => ({
  id: nextId++,
  startedAt: 0,
  endedAt: minutes === null ? null : minutes * MIN,
  exerciseId,
  outcome,
});

describe('computeStats', () => {
  it('counts cravings the user got through and the median minutes they took', () => {
    const stats = computeStats([
      session(5, 'passed'),
      session(12, 'passed'),
      session(30, 'passed'),
      session(8, 'not_yet'),
      session(null, null),
    ]);
    expect(stats).toEqual({ gotThrough: 3, typicalMinutes: 12 });
  });

  it('uses the middle of an even number of values and rounds to whole minutes', () => {
    const four = [10, 11, 15, 30].map((m) => session(m, 'passed'));
    expect(computeStats(four).typicalMinutes).toBe(13);
  });

  it('never says less than one minute', () => {
    const quick = [0.2, 0.3, 0.4].map((m) => session(m, 'passed'));
    expect(computeStats(quick).typicalMinutes).toBe(1);
  });

  it('gives no "usually" figure until there are at least 3 cravings that passed', () => {
    expect(computeStats([session(5, 'passed'), session(6, 'passed')])).toEqual({
      gotThrough: 2,
      typicalMinutes: null,
    });
  });

  it('has nothing to report before the first craving is logged', () => {
    expect(computeStats([])).toEqual({ gotThrough: 0, typicalMinutes: null });
    expect(computeStats([session(5, 'not_yet')])).toEqual({ gotThrough: 0, typicalMinutes: null });
  });
});

describe('pickExercise', () => {
  it('prefers the exercise that has helped most often', () => {
    const sessions = [
      session(5, 'passed', 'urge-surfing'),
      session(5, 'passed', 'urge-surfing'),
      session(5, 'passed', 'five-senses'),
    ];
    expect(pickExercise(sessions, EXERCISES).id).toBe('urge-surfing');
  });

  it('with no history, picks at random but never a breath-holding exercise', () => {
    const picks = [0, 0.2, 0.4, 0.6, 0.8, 0.99].map((r) => pickExercise([], EXERCISES, () => r).id);
    expect(picks).not.toContain('box-breathing');
    expect(new Set(picks).size).toBeGreaterThan(1);
  });
});
