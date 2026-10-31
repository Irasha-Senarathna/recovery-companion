import { useEffect, type ReactNode, useState } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import { useTheme } from '../theme';
import { useReducedMotion } from './useReducedMotion';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

type Props = {
  /** 0–1: how far towards the next milestone. */
  fraction: number;
  size?: number;
  stroke?: number;
  /** Read out in place of the drawing. */
  label: string;
  testID?: string;
  children?: ReactNode;
};

/**
 * A soft ring that fills with a critically damped spring (no overshoot, so it
 * never looks like more than is true). It starts from wherever it is, so a
 * new value mid-fill just redirects it. With reduced motion it simply appears.
 */
export function ProgressRing({
  fraction,
  size = 220,
  stroke = 16,
  label,
  testID,
  children,
}: Props) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, fraction));
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    if (reduced) {
      progress.setValue(clamped);
      return;
    }
    const spring = Animated.spring(progress, {
      toValue: clamped,
      bounciness: 0,
      speed: 4,
      useNativeDriver: false,
    });
    spring.start();
    return () => spring.stop();
  }, [clamped, reduced, progress]);

  const offset = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [circumference, 0],
  });

  return (
    <View
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.wrap, { width: size, height: size }]}
    >
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Defs>
          <SvgGradient id="ring" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={theme.primary} />
            <Stop offset="1" stopColor={theme.sun} />
          </SvgGradient>
        </Defs>
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={theme.surfaceSoft}
          strokeWidth={stroke}
          fill="none"
        />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="url(#ring)"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={offset}
          // Start at 12 o'clock.
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <View style={styles.center} importantForAccessibility="no-hide-descendants">
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignSelf: 'center', alignItems: 'center', justifyContent: 'center' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
});
