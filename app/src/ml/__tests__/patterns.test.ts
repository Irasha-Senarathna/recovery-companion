import type { CheckIn } from '../../features/checkin/checkinRepo';
import type { SosSession } from '../../features/sos/sosRepo';
import { findPatterns, MIN_CHECKINS, slipContext } from '../patterns';

let nextId = 1;
function day(n: number) {
  const d = new Date(2026, 8, 1 + n);
  const pad = (v: number) => String(v).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function checkIn(n: number, levels: Partial<CheckIn> = {}): CheckIn {
  return {
    id: nextId++,
    day: day(n),
    createdAt: 0,
    mood: 2,
    sleep: 3,
    stress: 1,
    craving: 1,
    tags: [],
    demo: false,
    ...levels,
  };
}
function session(hour: number): SosSession {
  const start = new Date(2026, 8, 3, hour, 10).getTime();
  return { id: nextId++, startedAt: start, endedAt: null, exerciseId: null, outcome: null };
}

/** 20 days: every 4th day has poor sleep and stronger cravings. */
const history = Array.from({ length: 20 }, (_, n) =>
  n % 4 === 0 ? checkIn(n, { sleep: 0, craving: 3, tags: ['tired'] }) : checkIn(n),
);

describe('trigger map patterns', () => {
  it(`waits for ${MIN_CHECKINS} check-ins before saying anything`, () => {
    const result = findPatterns(history.slice(0, MIN_CHECKINS - 1), []);
    expect(result).toEqual({ ready: false, count: MIN_CHECKINS - 1, needed: MIN_CHECKINS });
  });

  it('finds that cravings are stronger after poor sleep, with both averages', () => {
    const result = findPatterns(history, []);
    if (!result.ready) throw new Error('expected ready');
    const sleep = result.patterns.find((p) => p.id === 'poor_sleep');
    expect(sleep).toMatchObject({ withAvg: 3, withoutAvg: 1, days: 5 });
  });

  it('ignores differences too small to matter or seen on too few days', () => {
    const flat = Array.from({ length: 20 }, (_, n) =>
      checkIn(n, { craving: n % 2, stress: n === 3 ? 4 : 1 }),
    );
    const result = findPatterns(flat, []);
    if (!result.ready) throw new Error('expected ready');
    expect(result.patterns).toEqual([]);
  });

  it('names the hardest time of day from SOS moments, once there are enough', () => {
    const evening = [session(19), session(20), session(18), session(9)];
    const result = findPatterns(history, evening);
    if (!result.ready) throw new Error('expected ready');
    expect(result.hardestTime).toBe('evening');
    const few = findPatterns(history, evening.slice(0, 2));
    expect(few.ready && few.hardestTime).toBeNull();
  });

  it('says when demo data is part of the picture', () => {
    const withDemo = [...history.slice(1), checkIn(30, { demo: true })];
    const result = findPatterns(withDemo, []);
    expect(result.ready && result.usesDemo).toBe(true);
  });
});

describe('slip context (answers to the slip questions feed the trigger map)', () => {
  const slip = (feelings: string[], before: string[]) =>
    ({ place: null, feelings, before }) as never;

  it('names what was noted around at least two slips, most often first', () => {
    const result = slipContext([
      slip(['lonely'], ['argument']),
      slip(['angry'], ['payday']),
      slip(['lonely'], ['nothing']),
    ]);
    expect(result).toEqual([
      { tag: 'alone', count: 2 },
      { tag: 'conflict', count: 2 },
    ]);
  });

  it('says nothing from a single slip', () => {
    expect(slipContext([slip(['lonely'], ['argument'])])).toEqual([]);
  });
});

it('counts what was noted around slips once per day', () => {
  const slip = (day: string) => ({ day, place: null, feelings: ['lonely'], before: [] }) as never;
  expect(slipContext([slip('2026-10-01'), slip('2026-10-01')])).toEqual([]);
  expect(slipContext([slip('2026-10-01'), slip('2026-10-02')])).toEqual([
    { tag: 'alone', count: 2 },
  ]);
});
