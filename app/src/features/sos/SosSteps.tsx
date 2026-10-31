import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Linking, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { CalmScene } from '../../components/illustrations/CalmScene';
import { detectCrisis } from '../../safety/crisisDetector';
import type { Database } from '../../storage/types';
import { useTheme } from '../../theme';
import { phoneTelUri } from '../../utils/phone';
import { useSession } from '../session/SessionProvider';
import { ReasonView } from '../vault/ReasonView';
import type { VaultItem } from '../vault/vaultRepo';
import { EXERCISES, type Exercise } from './exercises';
import type { SosOutcome } from './sosRepo';
import type { SosStats } from './stats';

/**
 * Shown at the top of SOS and during exercises: someone in danger (or near
 * someone who may have overdosed) must not have to sit through an exercise.
 */
export function CrisisHelpLink() {
  const { t } = useTranslation();
  const router = useRouter();
  return (
    <Card tone="soft">
      <BodyText>{t('sos.notSafe')}</BodyText>
      <ActionButton
        testID="sos-crisis-help"
        tone="danger"
        label={t('sos.getHelpNow')}
        onPress={() => router.push({ pathname: '/help', params: { reason: 'crisis' } })}
      />
    </Card>
  );
}

export function ChooseStep({
  onPick,
  onAutoPick,
}: {
  onPick: (exercise: Exercise) => void;
  onAutoPick: () => void;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  return (
    <>
      <CrisisHelpLink />
      <CalmScene />
      <Text style={[styles.lead, { color: theme.text }]}>{t('sos.subtitle')}</Text>
      <ActionButton testID="sos-auto-pick" label={t('sos.autoPick')} onPress={onAutoPick} />
      <Heading>{t('sos.choose')}</Heading>
      {EXERCISES.map((exercise) => (
        <ActionButton
          key={exercise.id}
          testID={`exercise-${exercise.id}`}
          tone="plain"
          label={`${t(exercise.title)} · ${t('sos.minutes', {
            minutes: Math.max(1, Math.round(exercise.duration_seconds / 60)),
          })}`}
          onPress={() => onPick(exercise)}
        />
      ))}
    </>
  );
}

export function ReasonStep({
  item,
  db,
  onNext,
  onAnother,
}: {
  item: VaultItem;
  db: Database;
  onNext: () => void;
  onAnother: () => void;
}) {
  const { t } = useTranslation();
  // A saved reason can mention hard things; offer help right next to it.
  const crisis = item.kind === 'text' && detectCrisis(item.text ?? '');
  return (
    <>
      <Heading>{t('sos.reasonTitle')}</Heading>
      <Card tone="accent">
        <ReasonView item={item} db={db} />
      </Card>
      {crisis ? <CrisisHelpLink /> : null}
      <ActionButton testID="reason-next" label={t('sos.reasonNext')} onPress={onNext} />
      <ActionButton
        testID="reason-another"
        tone="soft"
        label={t('sos.showAnother')}
        onPress={onAnother}
      />
    </>
  );
}

/** Reach out or get help. Shared by the options and "not yet" steps. */
export function SupportActions() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { settings } = useSession();
  const { supportName, supportPhone } = settings;
  const [callFailed, setCallFailed] = useState(false);

  const call = async (phone: string) => {
    try {
      await Linking.openURL(phoneTelUri(phone));
    } catch {
      setCallFailed(true);
    }
  };

  return (
    <>
      {supportName && supportPhone ? (
        <>
          <ActionButton
            testID="sos-call-support"
            label={t('sos.callSupport', { name: supportName })}
            onPress={() => call(supportPhone)}
          />
          <Text style={[styles.phone, { color: theme.textMuted }]}>{supportPhone}</Text>
          {callFailed ? <BodyText>{t('sos.callFailed', { phone: supportPhone })}</BodyText> : null}
        </>
      ) : (
        <ActionButton
          testID="sos-add-support"
          tone="soft"
          label={t('sos.addSupport')}
          onPress={() => router.push('/settings')}
        />
      )}
      <ActionButton
        testID="sos-get-help"
        tone="danger"
        label={t('sos.getHelp')}
        onPress={() => router.push('/help')}
      />
    </>
  );
}

export function OptionsStep({ onOkay }: { onOkay: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Heading>{t('sos.optionsTitle')}</Heading>
      <SupportActions />
      <ActionButton testID="sos-okay" tone="soft" label={t('sos.okay')} onPress={onOkay} />
    </>
  );
}

export function OutcomeStep({ onAnswer }: { onAnswer: (outcome: SosOutcome) => void }) {
  const { t } = useTranslation();
  return (
    <>
      <Heading>{t('sos.outcomeTitle')}</Heading>
      <ActionButton
        testID="outcome-passed"
        label={t('sos.outcomePassed')}
        onPress={() => onAnswer('passed')}
      />
      <ActionButton
        testID="outcome-not-yet"
        tone="soft"
        label={t('sos.outcomeNotYet')}
        onPress={() => onAnswer('not_yet')}
      />
      <ActionButton
        testID="outcome-unsure"
        tone="soft"
        label={t('sos.outcomeUnsure')}
        onPress={() => onAnswer('unsure')}
      />
    </>
  );
}

const DONE_TEXT: Record<SosOutcome, string> = {
  passed: 'sos.donePassed',
  not_yet: 'sos.doneNotYet',
  unsure: 'sos.doneUnsure',
};

export function DoneStep({
  outcome,
  stats,
  onTryAnother,
}: {
  outcome: SosOutcome;
  stats: SosStats | null;
  onTryAnother: () => void;
}) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();

  return (
    <>
      <CalmScene />
      <Card tone={outcome === 'passed' ? 'accent' : 'soft'}>
        <Text testID="sos-done" style={[styles.lead, { color: theme.text }]}>
          {t(DONE_TEXT[outcome])}
        </Text>
        {outcome === 'passed' && stats ? <StatsText stats={stats} /> : null}
      </Card>
      {outcome === 'passed' ? null : (
        <>
          <ActionButton
            testID="sos-try-another"
            label={t('sos.tryAnother')}
            onPress={onTryAnother}
          />
          <SupportActions />
        </>
      )}
      <ActionButton
        testID="sos-finish"
        tone="plain"
        label={t('sos.home')}
        onPress={() => router.replace('/')}
      />
    </>
  );
}

export function StatsText({ stats }: { stats: SosStats }) {
  const { t } = useTranslation();
  if (stats.gotThrough === 0) {
    return <EmptyState testID="sos-stats-empty" message={t('progress.empty')} />;
  }
  return (
    <>
      <BodyText>{t('progress.gotThrough', { count: stats.gotThrough })}</BodyText>
      {stats.typicalMinutes !== null ? (
        <BodyText>{t('progress.typical', { count: stats.typicalMinutes })}</BodyText>
      ) : null}
    </>
  );
}

function Heading({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700' },
  lead: { fontSize: 20, lineHeight: 30, fontWeight: '600' },
  phone: { fontSize: 15, textAlign: 'center' },
});
