import { explain } from '../explain';
import { buildFeatures } from '../featureBuilder';

const calm = { day: '2026-11-02', mood: 3, sleep: 3, stress: 1, craving: 0, tags: [] };

describe('explain', () => {
  it('names the things that raised the score, strongest first, at most three', () => {
    const hard = { ...calm, day: '2026-10-31', sleep: 0, stress: 4, tags: ['old_routine'] };
    const reasons = explain(buildFeatures(hard, []));
    expect(reasons.length).toBeLessThanOrEqual(3);
    expect(reasons).toEqual(expect.arrayContaining(['high_stress', 'poor_sleep']));
  });

  it('never repeats a reason, even when two features point to it', () => {
    const hard = { ...calm, sleep: 0, stress: 4 };
    const reasons = explain(buildFeatures(hard, []), 10);
    expect(new Set(reasons).size).toBe(reasons.length);
  });

  it('only gives reasons that are true today', () => {
    const reasons = explain(buildFeatures(calm, []), 10);
    expect(reasons).not.toContain('poor_sleep');
    expect(reasons).not.toContain('high_stress');
    expect(reasons).not.toContain('weekend');
  });

  it('never gives "in pain" as a reason (no medical framing)', () => {
    const reasons = explain(buildFeatures({ ...calm, tags: ['pain'] }, []), 20);
    expect(reasons).not.toContain('tag_pain');
  });
});
