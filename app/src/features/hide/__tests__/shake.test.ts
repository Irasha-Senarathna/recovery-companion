import { createShakeDetector } from '../useShakeToHide';

const still = (t: number) => ({ x: 0, y: 0, z: 1, timestamp: t });
const jolt = (t: number) => ({ x: 2.5, y: 1, z: 1, timestamp: t });

describe('shake detector', () => {
  it('ignores normal movement', () => {
    const detect = createShakeDetector();
    const hits = [0, 0.1, 0.2, 0.3, 0.4].map((t) => detect(still(t)));
    expect(hits).not.toContain(true);
  });

  it('fires on three strong jolts within a second', () => {
    const detect = createShakeDetector();
    expect(detect(jolt(0))).toBe(false);
    expect(detect(jolt(0.3))).toBe(false);
    expect(detect(jolt(0.6))).toBe(true);
  });

  it('ignores jolts spread out over more than a second', () => {
    const detect = createShakeDetector();
    expect([0, 0.8, 1.6, 2.4].map((t) => detect(jolt(t)))).not.toContain(true);
  });

  it('fires only once per shake', () => {
    const detect = createShakeDetector();
    const results = [0, 0.1, 0.2, 0.3, 0.4, 0.5].map((t) => detect(jolt(t)));
    expect(results.filter(Boolean)).toHaveLength(1);
  });
});
