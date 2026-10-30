import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { Pattern } from '../../ml/patterns';
import { RADIUS, useTheme } from '../../theme';

const MAX_LEVEL = 4;

/**
 * Two bars: average craving on these days versus other days. The whole chart
 * is one element for screen readers, read out as a sentence with the numbers.
 */
export function PatternChart({ pattern, condition }: { pattern: Pattern; condition: string }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const bar = (label: string, value: number, color: string) => (
    <View style={styles.row}>
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      <View style={[styles.track, { backgroundColor: theme.surfaceSoft }]}>
        <View style={[styles.fill, { backgroundColor: color, flex: Math.max(value, 0.05) }]} />
        <View style={{ flex: MAX_LEVEL - value }} />
      </View>
      <Text style={[styles.value, { color: theme.textMuted }]}>{value.toFixed(1)}</Text>
    </View>
  );

  return (
    <View
      testID={`pattern-chart-${pattern.id}`}
      accessible
      accessibilityLabel={t('triggers.chartLabel', {
        condition,
        with: pattern.withAvg.toFixed(1),
        without: pattern.withoutAvg.toFixed(1),
      })}
      style={styles.chart}
    >
      {bar(t('triggers.withLabel'), pattern.withAvg, theme.textMuted)}
      {bar(t('triggers.withoutLabel'), pattern.withoutAvg, theme.border)}
    </View>
  );
}

const styles = StyleSheet.create({
  chart: { gap: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  label: { width: 96, fontSize: 14 },
  track: {
    flex: 1,
    height: 12,
    borderRadius: RADIUS.pill,
    flexDirection: 'row',
    overflow: 'hidden',
  },
  fill: { borderRadius: RADIUS.pill },
  value: { width: 32, fontSize: 14, textAlign: 'right' },
});
