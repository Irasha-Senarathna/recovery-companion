import fixtures from '../fixtures.json';
import model from '../model.json';
import { buildFeatures, FEATURES } from '../featureBuilder';
import { isHarderDay, predictRisk } from '../predict';

describe('the app computes exactly what Python computed (ml/export.py fixtures)', () => {
  it('uses the same feature list as model.json', () => {
    expect([...FEATURES]).toEqual(model.features);
  });

  it.each(fixtures.map((f, i) => [i, f] as const))('fixture %i: features match', (_, f) => {
    const features = buildFeatures(f.today, f.previous);
    features.forEach((value, i) => expect(value).toBeCloseTo(f.features[i], 9));
  });

  it.each(fixtures.map((f, i) => [i, f] as const))('fixture %i: score within 1e-6', (_, f) => {
    const score = predictRisk(buildFeatures(f.today, f.previous));
    expect(Math.abs(score - f.score)).toBeLessThan(1e-6);
  });

  it('a harder day is a score at or above the exported threshold', () => {
    expect(isHarderDay(model.threshold)).toBe(true);
    expect(isHarderDay(model.threshold - 1e-9)).toBe(false);
  });

  it('the weekend flag follows the calendar day (Saturday and Sunday)', () => {
    const base = { mood: 2, sleep: 2, stress: 2, craving: 1, tags: [] };
    const weekend = FEATURES.indexOf('weekend');
    expect(buildFeatures({ ...base, day: '2026-10-31' }, [])[weekend]).toBe(1); // Saturday
    expect(buildFeatures({ ...base, day: '2026-11-02' }, [])[weekend]).toBe(0); // Monday
  });
});
