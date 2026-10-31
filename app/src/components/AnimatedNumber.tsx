import { useEffect, useState } from 'react';
import { Animated, Text, type TextStyle } from 'react-native';
import { DISPLAY_TEXT_MAX_SCALE } from '../theme';
import { useReducedMotion } from './useReducedMotion';

type Props = {
  value: number;
  style?: TextStyle | TextStyle[];
  format?: (n: number) => string;
  testID?: string;
};

/**
 * A number that counts up to its value with a calm spring. Digits are
 * tabular, so the width stays steady while it counts. Screen readers and
 * reduced motion get the final value straight away. It is display text
 * (32 sp and up), so it stops growing at DISPLAY_TEXT_MAX_SCALE and stays inside its ring.
 */
export function AnimatedNumber({ value, style, format = String, testID }: Props) {
  const reduced = useReducedMotion();
  const anim = useState(() => new Animated.Value(0))[0];
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduced) return;
    const id = anim.addListener(({ value: v }) => setShown(Math.round(v)));
    const spring = Animated.spring(anim, {
      toValue: value,
      bounciness: 0,
      speed: 4,
      useNativeDriver: false,
    });
    spring.start(() => setShown(value));
    return () => {
      spring.stop();
      anim.removeListener(id);
    };
  }, [value, reduced, anim]);

  return (
    <Text
      testID={testID}
      accessibilityLabel={format(value)}
      maxFontSizeMultiplier={DISPLAY_TEXT_MAX_SCALE}
      style={[{ fontVariant: ['tabular-nums'] }, style]}
    >
      {format(reduced ? value : shown)}
    </Text>
  );
}
