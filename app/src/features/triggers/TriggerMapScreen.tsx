import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { ScreenLayout } from '../../components/ScreenLayout';
import { findPatterns, type PatternResult } from '../../ml/patterns';
import type { Database } from '../../storage/types';
import { useTheme } from '../../theme';
import { listCheckIns } from '../checkin/checkinRepo';
import { useSession } from '../session/SessionProvider';
import { listSessions } from '../sos/sosRepo';
import { assessToday, type Today } from './earlyWarning';
import { HarderDayCard } from './HarderDayCard';
import { NudgeToggle } from './NudgeToggle';
import { PatternChart } from './PatternChart';

/** "Your patterns": plain-language patterns from the user's own check-ins. */
export function TriggerMapScreen() {
  const { t } = useTranslation();
  const { db } = useSession();
  return (
    <ScreenLayout title={t('triggers.title')}>{db ? <TriggerMap db={db} /> : null}</ScreenLayout>
  );
}

function TriggerMap({ db }: { db: Database }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [result, setResult] = useState<PatternResult | null>(null);
  const [today, setToday] = useState<Today | null>(null);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const [checkIns, sessions, assessed] = await Promise.all([
        listCheckIns(db),
        listSessions(db),
        assessToday(db),
      ]);
      if (!mounted) return;
      setResult(findPatterns(checkIns, sessions));
      setToday(assessed);
    })();
    return () => {
      mounted = false;
    };
  }, [db]);

  const heading = [styles.heading, { color: theme.text }];
  const condition = (id: string) => t(`triggers.conditions.${id}`);

  return (
    <>
      {today?.harder ? <HarderDayCard testID="today-harder" reasons={today.reasons} /> : null}

      {result && !result.ready ? (
        <Card>
          <Text testID="triggers-progress" style={[styles.big, { color: theme.text }]}>
            {t('triggers.notReady', { count: result.count, needed: result.needed })}
          </Text>
          <BodyText>{t('triggers.notReadyInfo')}</BodyText>
        </Card>
      ) : null}

      {result?.ready ? (
        <>
          <Text testID="triggers-progress" accessibilityRole="header" style={heading}>
            {t('triggers.patternsTitle')}
          </Text>
          {result.hardestTime ? (
            <Card tone="accent">
              <BodyText>{t(`triggers.hardestTime.${result.hardestTime}`)}</BodyText>
            </Card>
          ) : null}
          {result.patterns.length === 0 ? <BodyText>{t('triggers.noPatterns')}</BodyText> : null}
          {result.patterns.map((pattern) => (
            <Card key={pattern.id}>
              <Text testID={`pattern-${pattern.id}`} style={[styles.big, { color: theme.text }]}>
                {t('triggers.patternSentence', { condition: condition(pattern.id) })}
              </Text>
              <PatternChart pattern={pattern} condition={condition(pattern.id)} />
            </Card>
          ))}
          {result.usesDemo ? <BodyText>{t('triggers.usesDemo')}</BodyText> : null}
        </>
      ) : null}

      <ActionButton
        testID="open-coping-plan-main"
        tone="soft"
        label={t('triggers.openPlan')}
        onPress={() => router.push('/coping-plan')}
      />
      <Text style={[styles.note, { color: theme.textMuted }]}>{t('triggers.honesty')}</Text>
      <NudgeToggle />
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  big: { fontSize: 18, lineHeight: 26, fontWeight: '600' },
  note: { fontSize: 15, lineHeight: 22 },
});
