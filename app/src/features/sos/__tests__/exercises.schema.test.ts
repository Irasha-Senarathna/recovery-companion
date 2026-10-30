import fs from 'fs';
import path from 'path';
import en from '../../../i18n/locales/en.json';
import si from '../../../i18n/locales/si.json';
import ta from '../../../i18n/locales/ta.json';
import { EXERCISES, expandSteps, getExercise } from '../exercises';

const CONTENT_DIR = path.join(__dirname, '..', '..', '..', '..', '..', 'content', 'exercises');
const TYPES = ['breathing', 'grounding', 'urge-surfing', 'distraction', 'reach-out'];
const ANIMATIONS = ['inhale', 'exhale', 'hold', 'wave'];

type Tree = { [key: string]: string | Tree };
const lookup = (tree: Tree, key: string): unknown =>
  key.split('.').reduce<unknown>((node, part) => (node as Tree | undefined)?.[part], tree);

describe('coping exercises', () => {
  it('loads every file in content/exercises', () => {
    const files = fs
      .readdirSync(CONTENT_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(EXERCISES.map((e) => e.id).sort()).toEqual(files);
  });

  it('has the planned mix: 2 breathing, 2 grounding, 1 urge surfing, 1 distraction', () => {
    const count = (type: string) => EXERCISES.filter((e) => e.type === type).length;
    expect(EXERCISES).toHaveLength(6);
    expect([
      count('breathing'),
      count('grounding'),
      count('urge-surfing'),
      count('distraction'),
    ]).toEqual([2, 2, 1, 1]);
  });

  describe.each(EXERCISES.map((e) => [e.id, e] as const))('%s', (_, exercise) => {
    it('has a valid type, steps and animations', () => {
      expect(TYPES).toContain(exercise.type);
      expect(exercise.steps.length).toBeGreaterThan(0);
      expect(exercise.rounds).toBeGreaterThanOrEqual(1);
      for (const step of exercise.steps) {
        expect(step.seconds).toBeGreaterThan(0);
        if (step.animation) expect(ANIMATIONS).toContain(step.animation);
      }
    });

    it('step timings add up to duration_seconds', () => {
      const total = expandSteps(exercise).reduce((sum, step) => sum + step.seconds, 0);
      expect(total).toBe(exercise.duration_seconds);
    });

    it.each([
      ['en', en],
      ['si', si],
      ['ta', ta],
    ])('has all text in %s', (_lang, locale) => {
      for (const key of [exercise.title, ...exercise.steps.map((s) => s.text)]) {
        const text = lookup(locale as Tree, key);
        expect(typeof text === 'string' && text.trim() !== '').toBe(true);
      }
    });
  });

  it('finds exercises by id', () => {
    expect(getExercise('box-breathing')?.type).toBe('breathing');
    expect(getExercise('nope')).toBeUndefined();
  });
});
