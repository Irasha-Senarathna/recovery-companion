import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { ChipGroup } from '../../components/ChipGroup';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ProgressRing } from '../../components/ProgressRing';
import { ScreenLayout } from '../../components/ScreenLayout';
import { StepTransition } from '../../components/StepTransition';
import { useTheme } from '../../theme';
import { localDay } from '../checkin/checkinRepo';
import { useJourney } from '../progress/useJourney';
import { useSession } from '../session/SessionProvider';
import { SupportActions } from '../sos/SosSteps';
import { addDays, type Progress } from './progress';
import { NO_ANSWERS, QUESTIONS, type SlipAnswers } from './questions';
import { deleteSlip, saveAnswers, saveSlip } from './slipRepo';

type Step = 'welcome' | 'counted' | 'place' | 'feelings' | 'before' | 'reach';
const ORDER = ['place', 'feelings', 'before'] as const;
type QuestionStep = (typeof ORDER)[number];
const isQuestion = (step: Step): step is QuestionStep => (ORDER as readonly Step[]).includes(step);

/**
 * After a slip: care first, then proof that nothing built so far is lost,
 * then three optional questions, then someone to reach out to.
 */
export function SlipFlow() {
  const { t } = useTranslation();
  const { db } = useSession();
  const router = useRouter();
  const { reload } = useJourney();
  const [step, setStep] = useState<Step>('welcome');
  const [slipId, setSlipId] = useState<number | null>(null);
  const [progress, setProgress] = useState<Progress | null>(null);
  const [answers, setAnswers] = useState<SlipAnswers>(NO_ANSWERS);

  const [saveFailed, setSaveFailed] = useState(false);

  // Never a dead end: if saving fails, the user still lands on reaching out.
  const save = async (day: string) => {
    try {
      if (!db) throw new Error('locked');
      setSlipId(await saveSlip(db, day));
      const loaded = await reload();
      setProgress(loaded);
      setStep(loaded ? 'counted' : 'reach');
    } catch {
      setSaveFailed(true);
      setStep('reach');
    }
  };

  const undo = async () => {
    if (db && slipId !== null) await deleteSlip(db, slipId);
    router.back();
  };

  // Answers are saved as they go, so leaving at any point keeps what was given.
  const next = async (current: Step, latest: SlipAnswers) => {
    if (db && slipId !== null) await saveAnswers(db, slipId, latest);
    const index = isQuestion(current) ? ORDER.indexOf(current) : -1;
    setStep(index >= 0 && index < ORDER.length - 1 ? ORDER[index + 1] : 'reach');
  };

  return (
    <ScreenLayout title={t('slip.title')}>
      <StepTransition stepKey={step}>
        {step === 'welcome' ? <Welcome onSave={save} /> : null}
        {step === 'counted' && progress ? (
          <Counted
            progress={progress}
            onContinue={() => setStep('place')}
            onSkip={() => setStep('reach')}
            onUndo={undo}
          />
        ) : null}
        {isQuestion(step) ? (
          <Question
            step={step}
            answers={answers}
            onChange={setAnswers}
            onNext={(latest) => next(step, latest)}
            onSkip={() => next(step, answers)}
          />
        ) : null}
        {step === 'reach' ? (
          <>
            {saveFailed ? <BodyText>{t('slip.saveError')}</BodyText> : null}
            <Reach />
          </>
        ) : null}
      </StepTransition>
    </ScreenLayout>
  );
}

function Welcome({ onSave }: { onSave: (day: string) => void }) {
  const { t } = useTranslation();
  const router = useRouter();
  const today = localDay();
  const [day, setDay] = useState<'today' | 'yesterday'>('today');
  const [busy, setBusy] = useState(false);

  return (
    <>
      <Lead>{t('slip.welcomeTitle')}</Lead>
      <BodyText>{t('slip.welcomeBody')}</BodyText>
      <Card tone="soft">
        <BodyText>{t('slip.unwell')}</BodyText>
        <ActionButton
          testID="slip-unwell-help"
          tone="danger"
          label={t('slip.unwellButton')}
          onPress={() => router.push({ pathname: '/help', params: { reason: 'crisis' } })}
        />
      </Card>
      <ChipGroup
        testID="slip-day"
        label={t('slip.when')}
        options={[
          { id: 'today', label: t('slip.today') },
          { id: 'yesterday', label: t('slip.yesterday') },
        ]}
        selected={[day]}
        onToggle={(id) => setDay(id as 'today' | 'yesterday')}
      />
      <ActionButton
        testID="slip-save"
        label={t('slip.save')}
        disabled={busy}
        onPress={async () => {
          setBusy(true);
          await onSave(day === 'today' ? today : addDays(today, -1));
        }}
      />
      <ActionButton
        testID="slip-not-now"
        tone="plain"
        label={t('slip.notNow')}
        onPress={() => router.back()}
      />
    </>
  );
}

function Counted({
  progress,
  onContinue,
  onSkip,
  onUndo,
}: {
  progress: Progress;
  onContinue: () => void;
  onSkip: () => void;
  onUndo: () => Promise<void>;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { strongDays, longestStretch } = progress;

  return (
    <View testID="slip-counted" style={styles.stack}>
      {/* No empty ring and big zero after a first-day slip: words only. */}
      {strongDays > 0 ? (
        <>
          <ProgressRing
            fraction={strongDays > 0 ? 1 : 0}
            size={200}
            label={t('progress.ringLabel', { count: strongDays, next: progress.next })}
          >
            <AnimatedNumber value={strongDays} style={[styles.ringNumber, { color: theme.text }]} />
            <Text style={[styles.ringCaption, { color: theme.textMuted }]}>
              {t('progress.strongDays')}
            </Text>
          </ProgressRing>
        </>
      ) : null}
      <Lead>
        {strongDays > 0 ? t('slip.stillCounts', { count: strongDays }) : t('slip.firstDay')}
      </Lead>
      {longestStretch > 1 ? (
        <BodyText>{t('slip.longest', { count: longestStretch })}</BodyText>
      ) : null}
      <BodyText>{t('slip.notTheEnd')}</BodyText>
      <ActionButton testID="slip-continue" label={t('slip.continue')} onPress={onContinue} />
      <ActionButton
        testID="slip-skip-questions"
        tone="plain"
        label={t('slip.skipQuestions')}
        onPress={onSkip}
      />
      <ConfirmAction
        testID="slip-undo"
        label={t('slip.undo')}
        question={t('slip.undoConfirm')}
        confirmLabel={t('slip.undoYes')}
        onConfirm={onUndo}
      />
    </View>
  );
}

function Question({
  step,
  answers,
  onChange,
  onNext,
  onSkip,
}: {
  step: QuestionStep;
  answers: SlipAnswers;
  onChange: (answers: SlipAnswers) => void;
  onNext: (latest: SlipAnswers) => void;
  onSkip: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const index = ORDER.indexOf(step);
  const multiple = step !== 'place';
  const selected: string[] =
    step === 'place' ? (answers.place ? [answers.place] : []) : [...answers[step]];

  const toggle = (id: string) => {
    if (step === 'place') {
      onChange({ ...answers, place: answers.place === id ? null : (id as SlipAnswers['place']) });
      return;
    }
    const list = answers[step] as string[];
    const nextList = list.includes(id) ? list.filter((x) => x !== id) : [...list, id];
    onChange({ ...answers, [step]: nextList });
  };

  return (
    <>
      <View
        style={styles.dots}
        accessible
        accessibilityLabel={t('slip.questionOf', { n: index + 1 })}
      >
        {ORDER.map((s, i) => (
          <View
            key={s}
            style={[
              styles.dot,
              { backgroundColor: i <= index ? theme.primary : theme.border },
              i === index ? styles.dotActive : null,
            ]}
          />
        ))}
      </View>
      <Lead>{t(`slip.questions.${step}`)}</Lead>
      <Text style={[styles.note, { color: theme.textMuted }]}>{t('slip.optional')}</Text>
      <ChipGroup
        testID={`slip-${step}`}
        label={t(`slip.questions.${step}`)}
        multiple={multiple}
        options={QUESTIONS[step].map((id) => ({ id, label: t(`slip.options.${id}`) }))}
        selected={selected}
        onToggle={toggle}
      />
      <ActionButton
        testID="slip-next"
        label={t('slip.next')}
        disabled={selected.length === 0}
        onPress={() => onNext(answers)}
      />
      <ActionButton testID="slip-skip" tone="plain" label={t('slip.skip')} onPress={onSkip} />
    </>
  );
}

function Reach() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <View testID="slip-reach" style={styles.stack}>
      <Lead>{t('slip.reachTitle')}</Lead>
      <BodyText>{t('slip.reachBody')}</BodyText>
      <SupportActions />
      <ActionButton
        testID="slip-circle"
        tone="soft"
        label={t('slip.askCircle')}
        onPress={() => router.push('/circle')}
      />
      <ActionButton
        testID="slip-plan"
        tone="soft"
        label={t('slip.openPlan')}
        onPress={() => router.push('/coping-plan')}
      />
      <ActionButton
        testID="slip-done"
        tone="plain"
        label={t('slip.done')}
        onPress={() => router.replace('/progress')}
      />
    </View>
  );
}

function Lead({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.lead, { color: theme.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  stack: { gap: 16 },
  lead: { fontSize: 24, lineHeight: 30, fontWeight: '700', letterSpacing: -0.4 },
  note: { fontSize: 15, lineHeight: 22 },
  ringNumber: { fontSize: 56, fontWeight: '800', letterSpacing: -1.5, lineHeight: 60 },
  ringCaption: { fontSize: 15, fontWeight: '600', letterSpacing: 0.2 },
  dots: { flexDirection: 'row', gap: 8, alignSelf: 'center', paddingVertical: 4 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 24 },
});
