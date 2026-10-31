import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../../theme';
import { journeyDays, type JourneyDay } from '../slip/progress';

const WEEKS = 4;

/**
 * The last four weeks as a quiet grid of dots. Strong days are filled; a slip
 * day is a hollow ring in a neutral colour (never red), so it reads as one day
 * among many rather than a mark against the user.
 */
export function JourneyStrip({
  start,
  today,
  slipDays,
}: {
  start: string;
  today: string;
  slipDays: readonly string[];
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const days = journeyDays({ start, today, slipDays, count: WEEKS * 7 });
  const strong = days.filter((d) => d.kind === 'strong').length;
  const slips = days.filter((d) => d.kind === 'slip').length;

  const dotStyle = (kind: JourneyDay['kind']) => {
    switch (kind) {
      case 'strong':
        return { backgroundColor: theme.primary, borderColor: theme.primary };
      case 'slip':
        return { backgroundColor: 'transparent', borderColor: theme.textMuted };
      case 'today':
        return { backgroundColor: theme.sun, borderColor: theme.primary };
      default:
        return { backgroundColor: theme.surfaceSoft, borderColor: theme.surfaceSoft };
    }
  };

  return (
    <View
      testID="journey-strip"
      accessible
      accessibilityLabel={t('progress.stripA11y', { strong, slips })}
      style={styles.wrap}
    >
      <View style={styles.grid}>
        {days.map((d) => (
          <View key={d.day} style={[styles.dot, dotStyle(d.kind)]} />
        ))}
      </View>
      <View style={styles.legend} importantForAccessibility="no-hide-descendants">
        <Legend style={dotStyle('strong')} label={t('progress.legendStrong')} />
        <Legend style={dotStyle('slip')} label={t('progress.legendSlip')} />
        <Legend style={dotStyle('today')} label={t('progress.legendToday')} />
      </View>
      <Text style={[styles.caption, { color: theme.textMuted }]}>
        {t('progress.stripLabel', { count: strong })}
      </Text>
    </View>
  );
}

function Legend({ style, label }: { style: object; label: string }) {
  const theme = useTheme();
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendDot, style]} />
      <Text style={[styles.legendText, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 12 },
  // 7 columns: one row per week.
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-between' },
  dot: { width: '11%', aspectRatio: 1, borderRadius: 999, borderWidth: 2 },
  legend: { flexDirection: 'row', flexWrap: 'wrap', gap: 16 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 12, height: 12, borderRadius: 6, borderWidth: 2 },
  legendText: { fontSize: 14 },
  caption: { fontSize: 15, lineHeight: 22 },
});
