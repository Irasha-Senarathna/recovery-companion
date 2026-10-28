import { Pressable, StyleSheet, Text } from 'react-native';
import { MIN_TAP, useTheme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'plain';
  disabled?: boolean;
  hint?: string;
  testID?: string;
};

export function ActionButton({ label, onPress, tone = 'primary', disabled, hint, testID }: Props) {
  const theme = useTheme();
  const background = { primary: theme.primary, danger: theme.help, plain: theme.surface }[tone];
  const color = { primary: theme.onPrimary, danger: theme.onHelp, plain: theme.text }[tone];

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: background, borderColor: theme.border },
        { opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP,
    paddingHorizontal: 16,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 17, fontWeight: '700' },
});
