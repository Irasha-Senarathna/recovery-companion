import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ProgressRing } from '../../components/ProgressRing';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useTheme } from '../../theme';
import { formatAmount, moneySaved } from '../goals/moneySaved';
import { useSession } from '../session/SessionProvider';
import { addDays, previousMilestone } from '../slip/progress';
import { deleteSlipsOn } from '../slip/slipRepo';
import { StatsText } from '../sos/SosSteps';
import { JourneyStrip } from './JourneyStrip';
import { StatTile } from './StatTile';
import { useJourney, type Journey } from './useJourney';

/** Strong days, the last four weeks, and the small numbers that add up. */
export function ProgressScreen() {
  const { t } = useTranslation();
  const { journey } = useJourney();
  return (
    <ScreenLayout title={t('progress.title')}>
      {journey ? <Overview journey={journey} /> : null}
    </ScreenLayout>
  );
}

function Overview({ journey }: { journey: Journey }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { settings } = useSession();
  const saved = moneySaved(settings.moneyPerDay, journey.strongDays);
  const previous = previousMilestone(journey.next);
  const fraction = (journey.strongDays - previous) / Math.max(1, journey.next - previous);

  return (
    <>
      <View style={styles.hero}>
        <ProgressRing
          testID="progress-ring"
          fraction={fraction}
          label={t('progress.ringLabel', { count: journey.strongDays, next: journey.next })}
        >
          {journey.strongDays === 0 ? (
            // Day one: words, not a big zero.
            <Text style={[styles.firstDay, { color: theme.text }]}>{t('progress.firstDay')}</Text>
          ) : (
            <>
              <AnimatedNumber
                testID="strong-days"
                value={journey.strongDays}
                style={[styles.ringNumber, { color: theme.text }]}
              />
              <Text style={[styles.ringCaption, { color: theme.textMuted }]}>
                {t('progress.strongDays')}
              </Text>
            </>
          )}
        </ProgressRing>
        {journey.strongDays > 0 ? (
          <Text style={[styles.next, { color: theme.textMuted }]}>
            {t('progress.nextMilestone', { count: journey.next })}
          </Text>
        ) : null}
      </View>

      <Card>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
          {t('progress.lastWeeks')}
        </Text>
        <JourneyStrip start={journey.start} today={journey.today} slipDays={journey.slipDays} />
      </Card>

      <View style={styles.tiles}>
        {journey.longestStretch > 1 ? (
          <StatTile
            testID="tile-longest"
            value={journey.longestStretch}
            label={t('progress.longest')}
          />
        ) : null}
        <StatTile
          testID="tile-got-through"
          value={journey.sos.gotThrough}
          label={t('progress.gotThroughShort')}
        />
        <StatTile testID="tile-checkins" value={journey.checkIns} label={t('progress.checkIns')} />
        {saved !== null ? (
          <StatTile
            testID="tile-money"
            value={saved}
            format={(n) => t('goals.amount', { amount: formatAmount(n) })}
            label={t('progress.moneyKept')}
          />
        ) : null}
      </View>

      <Card tone="accent">
        <StatsText stats={journey.sos} />
      </Card>

      <ActionButton
        testID="open-goals"
        tone="soft"
        label={t('progress.goals')}
        onPress={() => router.push('/goals')}
      />
      <StartDate journey={journey} />
      <RecentSlips journey={journey} />
      <ActionButton
        testID="open-slip"
        tone="plain"
        label={t('progress.logSlip')}
        hint={t('progress.logSlipHint')}
        onPress={() => router.push('/slip')}
      />
    </>
  );
}

/** "Counting from 12 Oct": the user can move it back to when they really began. */
function StartDate({ journey }: { journey: Journey }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { updateSettings, settings } = useSession();
  const [y, m, d] = journey.start.split('-').map(Number);
  // An earlier slip holds the start back; moving it later would change nothing.
  const heldBySlip = journey.start !== settings.journeyStart;
  const label = new Date(y, m - 1, d).toLocaleDateString(i18n.language, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
  const move = (days: number) => {
    const moved = addDays(journey.start, days);
    if (moved <= journey.today) updateSettings({ journeyStart: moved });
  };

  return (
    <Card tone="soft">
      <Text style={[styles.startLabel, { color: theme.text }]}>
        {t('progress.countingFrom', { date: label })}
      </Text>
      <BodyText>{t('progress.countingFromInfo')}</BodyText>
      <View style={styles.row}>
        <View style={styles.flex}>
          <ActionButton
            testID="start-week-earlier"
            tone="plain"
            label={t('progress.weekEarlier')}
            onPress={() => move(-7)}
          />
        </View>
        <View style={styles.flex}>
          <ActionButton
            testID="start-day-earlier"
            tone="plain"
            label={t('progress.dayEarlier')}
            onPress={() => move(-1)}
          />
        </View>
      </View>
      <ActionButton
        testID="start-day-later"
        tone="plain"
        label={t('progress.dayLater')}
        disabled={heldBySlip || journey.start >= journey.today}
        onPress={() => move(1)}
      />
    </Card>
  );
}

/** Slips in the last 4 weeks, each removable if it was logged by mistake. */
function RecentSlips({ journey }: { journey: Journey }) {
  const { t } = useTranslation();
  const { db } = useSession();
  const { reload } = useJourney();
  const recent = journey.slipDays.filter((day) => day >= addDays(journey.today, -27));
  if (!db || recent.length === 0) return null;
  return (
    <>
      {recent.map((day) => (
        <ConfirmAction
          key={day}
          testID={`remove-slip-${day}`}
          label={t('progress.removeSlip', { day })}
          question={t('progress.removeSlipConfirm', { day })}
          confirmLabel={t('progress.removeSlipYes')}
          onConfirm={async () => {
            await deleteSlipsOn(db, day);
            await reload();
          }}
        />
      ))}
    </>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', gap: 12, paddingVertical: 8 },
  ringNumber: { fontSize: 64, fontWeight: '800', letterSpacing: -2, lineHeight: 68 },
  ringCaption: { fontSize: 15, fontWeight: '600', letterSpacing: 0.3 },
  next: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
  firstDay: { fontSize: 16, lineHeight: 22, fontWeight: '600', textAlign: 'center' },
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  startLabel: { fontSize: 18, fontWeight: '700' },
  row: { flexDirection: 'row', gap: 10 },
  flex: { flex: 1 },
});
