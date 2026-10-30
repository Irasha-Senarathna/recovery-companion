import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { RADIUS, useTheme } from '../theme';

type Props = {
  children: ReactNode;
  tone?: 'surface' | 'soft' | 'accent';
  style?: ViewStyle;
  testID?: string;
};

/** A soft, rounded panel that floats gently on the gradient. */
export function Card({ children, tone = 'surface', style, testID }: Props) {
  const theme = useTheme();
  const backgroundColor = { surface: theme.surface, soft: theme.surfaceSoft, accent: theme.accent }[
    tone
  ];
  return (
    <View testID={testID} style={[styles.card, { backgroundColor }, style]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: RADIUS.card,
    padding: 20,
    gap: 12,
    shadowColor: '#1E2A28',
    shadowOpacity: 0.06,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 2,
  },
});
