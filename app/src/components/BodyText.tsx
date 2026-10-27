import type { ReactNode } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTheme } from '../theme';

export function BodyText({ children }: { children: ReactNode }) {
  const theme = useTheme();
  return <Text style={[styles.text, { color: theme.text }]}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: { fontSize: 17, lineHeight: 26 },
});
