import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { QuickHideButton } from '../features/hide/QuickHideButton';
import { WebDemoBanner } from '../platform/WebDemoBanner';
import { useTheme } from '../theme';
import { HelpButton } from './HelpButton';

type Props = {
  title: string;
  children?: ReactNode;
  testID?: string;
  /** Optional artwork shown above the content (decorative). */
  hero?: ReactNode;
};

/** Every route renders inside this, so the help button is always visible. */
export function ScreenLayout({ title, children, testID, hero }: Props) {
  const theme = useTheme();

  return (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <LinearGradient colors={theme.gradient} style={StyleSheet.absoluteFill} />
      <SafeAreaView testID={testID} style={styles.root}>
        <WebDemoBanner />
        <View style={styles.header}>
          <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
            {title}
          </Text>
          <View style={styles.actions}>
            <QuickHideButton />
            <HelpButton />
          </View>
        </View>
        <ScrollView contentContainerStyle={styles.content}>
          {hero}
          {children}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  actions: { flexDirection: 'row', gap: 8 },
  title: { flexShrink: 1, fontSize: 26, fontWeight: '700', letterSpacing: -0.3 },
  content: {
    padding: 20,
    gap: 16,
    paddingBottom: 48,
    width: '100%',
    maxWidth: 640,
    alignSelf: 'center',
  },
});
