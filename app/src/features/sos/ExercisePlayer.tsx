import { useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { useTheme } from '../../theme';
import { BreathingWave } from './BreathingWave';
import { expandSteps, type Exercise } from './exercises';
import { CrisisHelpLink } from './SosSteps';

/** True while a screen reader (TalkBack/VoiceOver) is on. */
function useScreenReader(): boolean {
  const [on, setOn] = useState(false);
  useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isScreenReaderEnabled().then(
      (value) => mounted && setOn(value),
      () => {},
    );
    const sub = AccessibilityInfo.addEventListener('screenReaderChanged', setOn);
    return () => {
      mounted = false;
      sub?.remove();
    };
  }, []);
  return on;
}

/**
 * One instruction at a time. Steps move on by themselves unless paused, or
 * while a screen reader is on (then the user moves on with "Next"), so nobody
 * is rushed. Each new step is announced to screen readers.
 */
export function ExercisePlayer({ exercise, onDone }: { exercise: Exercise; onDone: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const screenReader = useScreenReader();
  const steps = useMemo(() => expandSteps(exercise), [exercise]);
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const step = steps[index];
  const last = index === steps.length - 1;
  const text = t(step.text);

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility(text);
  }, [text, index]);

  useEffect(() => {
    if (paused || screenReader) return;
    const timer = setTimeout(() => (last ? onDone() : setIndex(index + 1)), step.seconds * 1000);
    return () => clearTimeout(timer);
  }, [index, last, onDone, step.seconds, paused, screenReader]);

  return (
    <>
      <Text style={[styles.meta, { color: theme.textMuted }]}>
        {t(exercise.title)} · {t('sos.stepOf', { current: index + 1, total: steps.length })}
      </Text>
      {exercise.type === 'breathing' ? <BodyText>{t('sos.breathingNote')}</BodyText> : null}
      {step.animation && !paused ? (
        <BreathingWave animation={step.animation} seconds={step.seconds} />
      ) : null}
      <Card tone="soft">
        <Text testID="exercise-step-text" style={[styles.step, { color: theme.text }]}>
          {text}
        </Text>
      </Card>
      <ActionButton
        testID="exercise-next"
        label={t('sos.next')}
        onPress={() => (last ? onDone() : setIndex(index + 1))}
      />
      <ActionButton
        testID="exercise-pause"
        tone="soft"
        label={paused ? t('sos.resume') : t('sos.pause')}
        onPress={() => setPaused(!paused)}
      />
      <ActionButton
        testID="exercise-finish"
        tone="plain"
        label={t('sos.finish')}
        onPress={onDone}
      />
      <CrisisHelpLink />
    </>
  );
}

const styles = StyleSheet.create({
  meta: { fontSize: 15, fontWeight: '600' },
  step: { fontSize: 22, lineHeight: 32, fontWeight: '600' },
});
