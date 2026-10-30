import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useReducedMotion } from '../../components/useReducedMotion';
import { useTheme } from '../../theme';

const SIZE = 184;

/** The big, calm SOS button: a softly breathing glow around a teal circle. */
export function SosButton({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const [glow] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(glow, {
          toValue: 1,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(glow, {
          toValue: 0,
          duration: 2400,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [glow, reduced]);

  const scale = glow.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] });
  const opacity = glow.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0.6] });

  return (
    <View style={styles.wrap}>
      <Animated.View
        pointerEvents="none"
        style={[styles.halo, { backgroundColor: theme.wave[1], opacity, transform: [{ scale }] }]}
      />
      <Pressable
        testID="sos-button"
        accessibilityRole="button"
        accessibilityLabel={t('sos.buttonLabel')}
        accessibilityHint={t('sos.buttonHint')}
        onPress={onPress}
        style={({ pressed }) => [styles.button, { opacity: pressed ? 0.9 : 1 }]}
      >
        <LinearGradient colors={theme.sos} style={styles.fill}>
          <Text style={[styles.title, { color: theme.onSos }]}>{t('sos.button')}</Text>
          <Text style={[styles.label, { color: theme.onSos }]}>{t('sos.buttonLabel')}</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center', paddingVertical: 24 },
  halo: { position: 'absolute', width: SIZE + 56, height: SIZE + 56, borderRadius: 999 },
  button: { width: SIZE, height: SIZE, minHeight: SIZE, borderRadius: 999, overflow: 'hidden' },
  fill: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 6 },
  title: { fontSize: 34, fontWeight: '800', letterSpacing: 2 },
  label: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
