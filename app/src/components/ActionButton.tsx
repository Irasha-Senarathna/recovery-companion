import { Pressable, StyleSheet, Text } from 'react-native';
import { MIN_TAP, RADIUS, useTheme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  tone?: 'primary' | 'danger' | 'plain' | 'soft';
  disabled?: boolean;
  hint?: string;
  testID?: string;
};

export function ActionButton({ label, onPress, tone = 'primary', disabled, hint, testID }: Props) {
  const theme = useTheme();
  const background = {
    primary: theme.primary,
    danger: theme.help,
    plain: theme.surface,
    soft: theme.surfaceSoft,
  }[tone];
  const color = {
    primary: theme.onPrimary,
    danger: theme.onHelp,
    plain: theme.text,
    soft: theme.text,
  }[tone];
  const borderColor = tone === 'plain' ? theme.border : background;

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
        { backgroundColor: background, borderColor },
        { opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        // Instant feedback on touch-down, not on release.
        pressed && !disabled ? styles.pressed : null,
      ]}
    >
      <Text style={[styles.label, { color }]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP + 8,
    paddingHorizontal: 20,
    borderRadius: RADIUS.button,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 17, fontWeight: '700' },
  pressed: { transform: [{ scale: 0.97 }] },
});
