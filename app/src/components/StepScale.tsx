import * as Haptics from 'expo-haptics';
import { useEffect, useRef, useState, type ComponentRef } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { MIN_TAP, RADIUS, useTheme } from '../theme';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  label: string;
  /** One label per step, lowest first. */
  levels: string[];
  value: number | null;
  onChange: (value: number) => void;
  /** Read out and shown before anything is chosen. */
  placeholder: string;
  /** Read out with the control, e.g. "Swipe up or down to change." */
  hint: string;
  /**
   * For measures where higher is not better (stress, cravings): a quieter
   * colour, so a high answer never looks like a goal reached.
   */
  neutral?: boolean;
  testID: string;
};

const MIDDLE = (count: number) => Math.floor(count / 2);
/** Sideways movement (dp) before a drag takes over from scrolling. */
const DRAG_THRESHOLD = 10;
const SELECTED_SCALE = 1.18;

/** How far along the row a step sits, as a CSS-style percentage. */
const percentOf = (value: number, max: number) => `${Math.round((value / max) * 100)}%` as const; // not-a-phone-number

/**
 * A "slider" made of large dots: tap one, or drag along the row and it follows
 * the finger step by step, with a light tick on each change. Screen readers
 * get one adjustable control (swipe up or down to change it).
 */
export function StepScale({
  label,
  levels,
  value,
  onChange,
  placeholder,
  hint,
  neutral = false,
  testID,
}: Props) {
  const theme = useTheme();
  const accent = neutral ? theme.textMuted : theme.primary;
  const reducedMotion = useReducedMotion();
  const max = levels.length - 1;
  const track = useRef<ComponentRef<typeof View>>(null);
  const bounds = useRef({ left: 0, width: 1 });
  // Kept current for the pan handlers, which are created once.
  const latest = useRef({ value, onChange, max });
  useEffect(() => {
    latest.current = { value, onChange, max };
  }, [value, onChange, max]);

  // Critically damped springs: the chosen dot grows without bouncing, and
  // each spring starts from wherever the dot is, so quick drags never jump.
  const [scales] = useState(() => levels.map(() => new Animated.Value(1)));
  useEffect(() => {
    scales.forEach((scale, index) => {
      const toValue = index === value ? SELECTED_SCALE : 1;
      if (reducedMotion) scale.setValue(toValue);
      else
        Animated.spring(scale, {
          toValue,
          bounciness: 0,
          speed: 18,
          useNativeDriver: Platform.OS !== 'web',
        }).start();
    });
  }, [scales, value, reducedMotion]);

  const choose = (index: number) => {
    const { value: current, onChange: change } = latest.current;
    if (index === current) return;
    Haptics.selectionAsync().catch(() => {});
    change(index);
  };

  const step = (delta: number) =>
    choose(value === null ? MIDDLE(levels.length) : Math.min(max, Math.max(0, value + delta)));

  // The handlers only read refs when a finger moves, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => {
    const indexAt = (pageX: number) => {
      const { left, width } = bounds.current;
      const ratio = (pageX - left) / width;
      return Math.min(latest.current.max, Math.max(0, Math.round(ratio * latest.current.max)));
    };
    return PanResponder.create({
      // Taps go to the dots; only a clearly sideways move becomes a drag.
      onMoveShouldSetPanResponder: (_, g) =>
        Math.abs(g.dx) > DRAG_THRESHOLD && Math.abs(g.dx) > Math.abs(g.dy),
      onPanResponderGrant: (_, g) => {
        // Dot centres sit half a tap target in from each end of the row.
        track.current?.measure((_x, _y, width, _h, pageX) => {
          bounds.current = { left: pageX + MIN_TAP / 2, width: Math.max(1, width - MIN_TAP) };
          choose(indexAt(g.moveX));
        });
      },
      onPanResponderMove: (_, g) => choose(indexAt(g.moveX)),
      onPanResponderTerminationRequest: () => false,
    });
  });

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="adjustable"
      accessibilityLabel={label}
      accessibilityHint={hint}
      accessibilityValue={{
        min: 0,
        max,
        now: value ?? undefined,
        text: value === null ? placeholder : levels[value],
      }}
      accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
      onAccessibilityAction={(event) => step(event.nativeEvent.actionName === 'increment' ? 1 : -1)}
      style={styles.container}
    >
      <View style={styles.header}>
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
        <Text style={[styles.value, { color: value === null ? theme.textMuted : theme.primary }]}>
          {value === null ? placeholder : levels[value]}
        </Text>
      </View>
      <View ref={track} style={styles.track} {...pan.panHandlers}>
        <View style={[styles.line, { backgroundColor: theme.border }]}>
          {value !== null ? (
            <View
              style={[styles.fill, { backgroundColor: accent, width: percentOf(value, max) }]}
            />
          ) : null}
        </View>
        {levels.map((level, index) => {
          const filled = value !== null && index <= value;
          const selected = index === value;
          return (
            <Pressable
              key={level}
              testID={`${testID}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={level}
              onPress={() => choose(index)}
              hitSlop={4}
              style={styles.hit}
            >
              <Animated.View
                style={[
                  styles.dot,
                  {
                    backgroundColor: selected ? accent : filled ? theme.surfaceSoft : theme.surface,
                    borderColor: filled ? accent : theme.border,
                    transform: [{ scale: scales[index] }],
                  },
                ]}
              />
            </Pressable>
          );
        })}
      </View>
      <View style={styles.ends}>
        <Text style={[styles.end, { color: theme.textMuted }]}>{levels[0]}</Text>
        <Text style={[styles.end, { color: theme.textMuted }]}>{levels[max]}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  header: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 },
  label: { fontSize: 18, fontWeight: '700', letterSpacing: -0.2 },
  value: { fontSize: 17, fontWeight: '600' },
  track: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  line: {
    position: 'absolute',
    left: MIN_TAP / 2,
    right: MIN_TAP / 2,
    height: 3,
    borderRadius: RADIUS.pill,
  },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  hit: { minWidth: MIN_TAP, minHeight: MIN_TAP, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 28, height: 28, borderRadius: RADIUS.pill, borderWidth: 2 },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { fontSize: 14 },
});
