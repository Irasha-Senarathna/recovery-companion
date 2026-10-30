import type { SosSession } from '../../features/sos/sosRepo';
import { DEFAULT_PEAK_HOUR, peakHour, planNudge, QUIET_END, QUIET_START } from '../nudgeScheduler';

const at = (hour: number, minute = 0, date = 30) => new Date(2026, 9, date, hour, minute).getTime();
const base = { score: 0.9, threshold: 0.3, lastNudgeAt: null, peak: 18 };

function session(hour: number): SosSession {
  return { id: hour, startedAt: at(hour), endedAt: null, exerciseId: null, outcome: null };
}

describe('planNudge', () => {
  it('plans one nudge an hour before the usual hard time', () => {
    expect(planNudge({ ...base, now: at(9) })).toBe(at(17));
  });

  it('does nothing on an ordinary day', () => {
    expect(planNudge({ ...base, score: 0.1, now: at(9) })).toBeNull();
  });

  it('at most one a day', () => {
    expect(planNudge({ ...base, now: at(9), lastNudgeAt: at(8) })).toBeNull();
    expect(planNudge({ ...base, now: at(9), lastNudgeAt: at(17, 0, 29) })).toBe(at(17));
  });

  it('never in quiet hours', () => {
    expect(QUIET_START).toBeGreaterThan(QUIET_END);
    // Peak at 23:00 → 22:00 would be quiet: no nudge.
    expect(planNudge({ ...base, peak: 23, now: at(9) })).toBeNull();
    // Peak at 08:00 → 07:00 is quiet: wait until quiet hours end.
    expect(planNudge({ ...base, peak: 8, now: at(6) })).toBe(at(QUIET_END));
  });

  it('not when the time has already passed (the app shows it in person instead)', () => {
    expect(planNudge({ ...base, now: at(16, 58) })).toBeNull();
  });
});

describe('peakHour', () => {
  it('is the median start hour of SOS moments, outside quiet hours', () => {
    expect(peakHour([session(19), session(21), session(20), session(3)])).toBe(20);
  });

  it('defaults to early evening without enough moments', () => {
    expect(peakHour([session(10)])).toBe(DEFAULT_PEAK_HOUR);
  });
});
