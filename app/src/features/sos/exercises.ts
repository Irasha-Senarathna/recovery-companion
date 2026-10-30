import boxBreathing from '../../../../content/exercises/box-breathing.json';
import changeTheScene from '../../../../content/exercises/change-the-scene.json';
import feetOnTheGround from '../../../../content/exercises/feet-on-the-ground.json';
import fiveSenses from '../../../../content/exercises/five-senses.json';
import slowBreathing from '../../../../content/exercises/slow-breathing.json';
import urgeSurfing from '../../../../content/exercises/urge-surfing.json';

export type ExerciseType = 'breathing' | 'grounding' | 'urge-surfing' | 'distraction' | 'reach-out';
export type StepAnimation = 'inhale' | 'exhale' | 'hold' | 'wave';

export type ExerciseStep = { text: string; seconds: number; animation?: StepAnimation };

/** A guided exercise from content/exercises. Text fields are i18n keys. */
export type Exercise = {
  id: string;
  type: ExerciseType;
  title: string;
  duration_seconds: number;
  rounds: number;
  steps: ExerciseStep[];
};

/** Every file in content/exercises (a test checks none is missing). */
export const EXERCISES = [
  slowBreathing,
  boxBreathing,
  fiveSenses,
  feetOnTheGround,
  urgeSurfing,
  changeTheScene,
] as Exercise[];

export function getExercise(id: string): Exercise | undefined {
  return EXERCISES.find((exercise) => exercise.id === id);
}

/** The steps in the order they are shown, with rounds repeated. */
export function expandSteps(exercise: Exercise): ExerciseStep[] {
  return Array.from({ length: exercise.rounds }, () => exercise.steps).flat();
}
