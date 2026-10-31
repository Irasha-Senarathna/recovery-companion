import { StyleSheet, Text, View } from 'react-native';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { RADIUS, useTheme } from '../../theme';

/** One number that matters, large and steady, with a short plain label. */
export function StatTile({
  value,
  label,
  format,
  testID,
}: {
  value: number;
  label: string;
  format?: (n: number) => string;
  testID: string;
}) {
  const theme = useTheme();
  return (
    <View
      testID={testID}
      accessible
      accessibilityLabel={`${format ? format(value) : value} ${label}`}
      style={[styles.tile, { backgroundColor: theme.surface }]}
    >
      <AnimatedNumber value={value} format={format} style={[styles.value, { color: theme.text }]} />
      <Text style={[styles.label, { color: theme.textMuted }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  tile: {
    flexBasis: '47%',
    flexGrow: 1,
    borderRadius: RADIUS.card,
    padding: 18,
    gap: 4,
    shadowColor: '#1E2A28',
    shadowOpacity: 0.05,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  value: { fontSize: 32, fontWeight: '800', letterSpacing: -0.8 },
  label: { fontSize: 15, lineHeight: 20, fontWeight: '600' },
});
