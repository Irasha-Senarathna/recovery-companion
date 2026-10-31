import type { Tag } from '../checkin/tags';

/**
 * The three gentle questions after a slip. Answers are fixed choices (no free
 * text), every one is optional, and each maps to the check-in tags the trigger
 * map already knows. Labels live in i18n under `slip.options`.
 */
export const QUESTIONS = {
  place: ['home', 'friends', 'risky_place', 'work', 'out', 'elsewhere'],
  feelings: ['stressed', 'lonely', 'low', 'bored', 'tired', 'angry', 'celebrating'],
  before: ['argument', 'money', 'payday', 'old_routine', 'party', 'work_pressure', 'nothing'],
} as const;

export type Place = (typeof QUESTIONS.place)[number];
export type Feeling = (typeof QUESTIONS.feelings)[number];
export type Before = (typeof QUESTIONS.before)[number];

const TAG_FOR: Partial<Record<Place | Feeling | Before, Tag>> = {
  risky_place: 'risky_place',
  friends: 'old_routine',
  lonely: 'alone',
  bored: 'bored',
  tired: 'tired',
  angry: 'conflict',
  celebrating: 'celebration',
  argument: 'conflict',
  money: 'money_worries',
  payday: 'payday',
  old_routine: 'old_routine',
  party: 'celebration',
  work_pressure: 'work_stress',
};

export type SlipAnswers = { place: Place | null; feelings: Feeling[]; before: Before[] };

export const NO_ANSWERS: SlipAnswers = { place: null, feelings: [], before: [] };

/** The check-in tags these answers point to (for the trigger map). */
export function tagsFor(answers: SlipAnswers): Tag[] {
  const ids = [answers.place, ...answers.feelings, ...answers.before];
  const tags = ids.flatMap((id) => (id && TAG_FOR[id] ? [TAG_FOR[id]] : []));
  return [...new Set(tags)];
}

export function isPlace(v: unknown): v is Place {
  return (QUESTIONS.place as readonly unknown[]).includes(v);
}
export function isFeeling(v: unknown): v is Feeling {
  return (QUESTIONS.feelings as readonly unknown[]).includes(v);
}
export function isBefore(v: unknown): v is Before {
  return (QUESTIONS.before as readonly unknown[]).includes(v);
}
