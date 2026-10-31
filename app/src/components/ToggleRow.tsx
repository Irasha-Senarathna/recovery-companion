import { StyleSheet, Switch, Text, View } from 'react-native';
import { MIN_TAP, useTheme } from '../theme';

type Props = {
  label: string;
  value: boolean;
  onValueChange: (value: boolean) => void;
  note?: string;
  disabled?: boolean;
  testID?: string;
};

export function ToggleRow({ label, value, onValueChange, note, disabled, testID }: Props) {
  const theme = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        {note ? <Text style={[styles.note, { color: theme.textMuted }]}>{note}</Text> : null}
      </View>
      <Switch
        testID={testID}
        accessibilityLabel={label}
        value={value}
        disabled={disabled}
        onValueChange={onValueChange}
        trackColor={{ true: theme.primary, false: theme.outline }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  row: { minHeight: MIN_TAP, flexDirection: 'row', alignItems: 'center', gap: 12 },
  text: { flex: 1, gap: 2 },
  label: { fontSize: 17 },
  note: { fontSize: 14 },
});
