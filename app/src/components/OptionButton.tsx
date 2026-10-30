import { Pressable, StyleSheet, Text } from 'react-native';
import { MIN_TAP, RADIUS, useTheme } from '../theme';

type Props = {
  label: string;
  onPress: () => void;
  selected?: boolean;
  testID?: string;
};

export function OptionButton({ label, onPress, selected = false, testID }: Props) {
  const theme = useTheme();

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        pressed ? styles.pressed : null,
        {
          borderColor: selected ? theme.primary : theme.border,
          backgroundColor: selected ? theme.primary : theme.surface,
        },
      ]}
    >
      <Text style={[styles.label, { color: selected ? theme.onPrimary : theme.text }]}>
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP,
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderRadius: RADIUS.button,
    justifyContent: 'center',
  },
  label: { fontSize: 17, fontWeight: '600' },
  pressed: { transform: [{ scale: 0.97 }], opacity: 0.85 },
});
