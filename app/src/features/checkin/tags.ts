import config from '../../../../content/checkin.json';

/** The four check-in questions, in screen order. */
export const MEASURES = ['mood', 'sleep', 'stress', 'craving'] as const;
export type Measure = (typeof MEASURES)[number];

/** Each answer is a whole step from `min` (lowest) to `max` (highest). */
export const SCALE = config.scale;
export const LEVELS = Array.from({ length: SCALE.max - SCALE.min + 1 }, (_, i) => SCALE.min + i);

/** Optional "what's going on" tags. Labels live in i18n under `checkin.tags`. */
export const TAGS: readonly string[] = config.tags;
export type Tag = string;

export function isTag(value: unknown): value is Tag {
  return typeof value === 'string' && TAGS.includes(value);
}

export function isLevel(value: unknown): value is number {
  return (
    Number.isInteger(value) && (value as number) >= SCALE.min && (value as number) <= SCALE.max
  );
}
