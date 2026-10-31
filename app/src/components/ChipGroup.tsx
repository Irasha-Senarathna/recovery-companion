import * as Haptics from 'expo-haptics';
import { useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TAP, RADIUS, useTheme } from '../theme';
import { useReducedMotion } from './useReducedMotion';

type Option = { id: string; label: string };

type Props = {
  options: Option[];
  selected: readonly string[];
  onToggle: (id: string) => void;
  /** One choice (radio) or several (checkboxes). */
  multiple?: boolean;
  /** Read out for the whole group. */
  label: string;
  testID: string;
};

/** Large, rounded choices that answer the touch the moment a finger lands. */
export function ChipGroup({ options, selected, onToggle, multiple = false, label, testID }: Props) {
  return (
    <View
      accessibilityRole={multiple ? undefined : 'radiogroup'}
      accessibilityLabel={label}
      style={styles.group}
    >
      {options.map((option) => (
        <Chip
          key={option.id}
          testID={`${testID}-${option.id}`}
          label={option.label}
          on={selected.includes(option.id)}
          multiple={multiple}
          onPress={() => onToggle(option.id)}
        />
      ))}
    </View>
  );
}

function Chip({
  label,
  on,
  multiple,
  onPress,
  testID,
}: {
  label: string;
  on: boolean;
  multiple: boolean;
  onPress: () => void;
  testID: string;
}) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = useState(() => new Animated.Value(1))[0];

  // Pressed in on touch-down; springs back from wherever it is on release.
  const springTo = (toValue: number) => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue,
      bounciness: 0,
      speed: 40,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        testID={testID}
        accessibilityRole={multiple ? 'checkbox' : 'radio'}
        accessibilityLabel={label}
        accessibilityState={{ checked: on }}
        onPressIn={() => springTo(0.95)}
        onPressOut={() => springTo(1)}
        onPress={() => {
          Haptics.selectionAsync().catch(() => {});
          onPress();
        }}
        style={[
          styles.chip,
          {
            backgroundColor: on ? theme.primary : theme.surface,
            borderColor: on ? theme.primary : theme.border,
          },
        ]}
      >
        <Text style={[styles.label, { color: on ? theme.onPrimary : theme.text }]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  group: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  chip: {
    minHeight: MIN_TAP,
    paddingHorizontal: 18,
    borderRadius: RADIUS.pill,
    borderWidth: 1.5,
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
