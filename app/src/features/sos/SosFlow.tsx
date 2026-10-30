import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenLayout } from '../../components/ScreenLayout';
import type { Database } from '../../storage/types';
import { useSession } from '../session/SessionProvider';
import { listItems, randomItem, type VaultItem } from '../vault/vaultRepo';
import { ExercisePlayer } from './ExercisePlayer';
import { EXERCISES, type Exercise } from './exercises';
import {
  finishSession,
  listSessions,
  setSessionExercise,
  startSession,
  type SosOutcome,
} from './sosRepo';
import { ChooseStep, DoneStep, OptionsStep, OutcomeStep, ReasonStep } from './SosSteps';
import { computeStats, pickExercise, type SosStats } from './stats';

type Phase =
  | { name: 'choose' }
  | { name: 'exercise'; exercise: Exercise }
  | { name: 'reason'; item: VaultItem }
  | { name: 'options' }
  | { name: 'outcome' }
  | { name: 'done'; outcome: SosOutcome; stats: SosStats | null };

/** Craving SOS: exercise → one reason → reach out or okay → did it pass? */
export function SosFlow() {
  const { t } = useTranslation();
  const { db } = useSession();
  return <ScreenLayout title={t('sos.title')}>{db ? <Flow db={db} /> : null}</ScreenLayout>;
}

function Flow({ db }: { db: Database }) {
  const [phase, setPhase] = useState<Phase>({ name: 'choose' });
  const sessionId = useRef<Promise<number> | null>(null);

  // Saved the moment SOS opens, so even a session left halfway is counted.
  useEffect(() => {
    sessionId.current ??= startSession(db);
  }, [db]);

  const startExercise = useCallback(
    async (exercise: Exercise) => {
      sessionId.current ??= startSession(db);
      await setSessionExercise(db, await sessionId.current, exercise.id);
      setPhase({ name: 'exercise', exercise });
    },
    [db],
  );

  const autoPick = async () => startExercise(pickExercise(await listSessions(db), EXERCISES));

  const afterExercise = useCallback(async () => {
    const item = await randomItem(db);
    setPhase(item ? { name: 'reason', item } : { name: 'options' });
  }, [db]);

  // "Show another": a different reason, if there is one.
  const anotherReason = async (current: VaultItem) => {
    const others = (await listItems(db)).filter((item) => item.id !== current.id);
    if (others.length) {
      setPhase({ name: 'reason', item: others[Math.floor(Math.random() * others.length)] });
    }
  };

  const answer = async (outcome: SosOutcome) => {
    if (sessionId.current) await finishSession(db, await sessionId.current, outcome);
    sessionId.current = null;
    const stats = outcome === 'passed' ? computeStats(await listSessions(db)) : null;
    setPhase({ name: 'done', outcome, stats });
  };

  switch (phase.name) {
    case 'choose':
      return <ChooseStep onPick={startExercise} onAutoPick={autoPick} />;
    case 'exercise':
      return <ExercisePlayer exercise={phase.exercise} onDone={afterExercise} />;
    case 'reason':
      return (
        <ReasonStep
          item={phase.item}
          db={db}
          onNext={() => setPhase({ name: 'options' })}
          onAnother={() => anotherReason(phase.item)}
        />
      );
    case 'options':
      return <OptionsStep onOkay={() => setPhase({ name: 'outcome' })} />;
    case 'outcome':
      return <OutcomeStep onAnswer={answer} />;
    case 'done':
      return (
        <DoneStep
          outcome={phase.outcome}
          stats={phase.stats}
          onTryAnother={() => setPhase({ name: 'choose' })}
        />
      );
  }
}
