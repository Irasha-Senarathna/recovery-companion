import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { WebDemoBanner } from '../platform/WebDemoBanner';
import { useTheme } from '../theme';
import { HelpButton } from './HelpButton';

type Props = { title: string; children?: ReactNode };

/** Every route renders inside this, so the help button is always visible. */
export function ScreenLayout({ title, children }: Props) {
  const theme = useTheme();

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: theme.background }]}>
      <WebDemoBanner />
      <View style={styles.header}>
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          {title}
        </Text>
        <HelpButton />
      </View>
      <ScrollView contentContainerStyle={styles.content}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: { flexShrink: 1, fontSize: 24, fontWeight: '700' },
  content: { padding: 16, gap: 16 },
});
