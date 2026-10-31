import { useEffect, useState } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../../components/useReducedMotion';
import { useTheme } from '../../theme';
import type { StepAnimation } from './exercises';

type Props = { animation: StepAnimation; seconds: number };

const LABEL: Record<StepAnimation, string> = {
  inhale: 'sos.breatheIn',
  exhale: 'sos.breatheOut',
  hold: 'sos.hold',
  wave: 'sos.wave',
};

const TARGET: Record<StepAnimation, number> = { inhale: 1, exhale: 0, hold: -1, wave: -1 };

/**
 * Layered circles that swell as you breathe in and settle as you breathe out,
 * over a gentle lagoon wave. With reduce-motion on, a still version shows the
 * same words.
 */
export function BreathingWave({ animation, seconds }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [breath] = useState(() => new Animated.Value(0.4));
  const [drift] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const target = TARGET[animation];
    const anims: Animated.CompositeAnimation[] = [];
    if (target >= 0) {
      anims.push(
        Animated.timing(breath, {
          toValue: target,
          duration: seconds * 1000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      );
    }
    anims.push(
      Animated.loop(
        Animated.timing(drift, {
          toValue: 1,
          duration: 6000,
          easing: Easing.linear,
          useNativeDriver: true,
        }),
      ),
    );
    const all = Animated.parallel(anims);
    all.start();
    return () => all.stop();
  }, [animation, seconds, breath, drift, reduced]);

  const label = t(LABEL[animation]);

  if (reduced) {
    return (
      <View testID="breathing-static" style={styles.stage}>
        <View style={[styles.circle, { backgroundColor: theme.wave[1] }]} />
        <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
      </View>
    );
  }

  const scale = breath.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.15] });
  const outer = breath.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1.3] });
  const shift = drift.interpolate({ inputRange: [0, 1], outputRange: [0, -120] });

  return (
    <View testID="breathing-wave" style={styles.stage} accessibilityLabel={label}>
      <Animated.View style={[styles.waveRow, { transform: [{ translateX: shift }] }]}>
        <Svg
          width={480}
          height={48}
          viewBox="0 0 480 48"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          <Path
            d="M0 24 C 30 8, 90 8, 120 24 S 210 40, 240 24 S 330 8, 360 24 S 450 40, 480 24 L 480 48 L 0 48 Z"
            fill={theme.wave[0]}
          />
        </Svg>
      </Animated.View>
      <Animated.View
        style={[styles.ring, { backgroundColor: theme.wave[2], transform: [{ scale: outer }] }]}
      />
      <Animated.View
        style={[styles.circle, { backgroundColor: theme.wave[1], transform: [{ scale }] }]}
      />
      <Text style={[styles.label, { color: theme.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { minHeight: 260, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { position: 'absolute', width: 200, height: 200, borderRadius: 999 },
  circle: { position: 'absolute', width: 160, height: 160, borderRadius: 999 },
  label: { fontSize: 22, fontWeight: '700' },
  waveRow: { position: 'absolute', bottom: 0, left: 0 },
});
