import { useEffect, type ReactNode, useState } from 'react';
import { Animated, Platform } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

/**
 * Each new step rises a little and fades in with a critically damped spring,
 * always from where the previous motion left it. Reduced motion: no movement,
 * the content is simply there.
 */
export function StepTransition({ stepKey, children }: { stepKey: string; children: ReactNode }) {
  const reduced = useReducedMotion();
  const enter = useState(() => new Animated.Value(1))[0];

  useEffect(() => {
    if (reduced) {
      enter.setValue(1);
      return;
    }
    enter.setValue(0);
    const spring = Animated.spring(enter, {
      toValue: 1,
      bounciness: 0,
      speed: 14,
      useNativeDriver: Platform.OS !== 'web',
    });
    spring.start();
    return () => spring.stop();
  }, [stepKey, reduced, enter]);

  const translateY = enter.interpolate({ inputRange: [0, 1], outputRange: [16, 0] });
  return (
    <Animated.View style={{ gap: 16, opacity: enter, transform: [{ translateY }] }}>
      {children}
    </Animated.View>
  );
}
