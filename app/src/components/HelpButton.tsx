import { usePathname, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TAP, useTheme } from '../theme';

/** Safety rule 2: rendered on every screen by ScreenLayout. */
export function HelpButton() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const onHelp = usePathname() === '/help';

  return (
    <Pressable
      testID="help-button"
      accessibilityRole="button"
      accessibilityLabel={t('help.button')}
      accessibilityHint={t('help.buttonHint')}
      onPress={() => {
        if (!onHelp) router.push('/help');
      }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: theme.help, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.label, { color: theme.onHelp }]}>{t('help.button')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP,
    minWidth: MIN_TAP,
    paddingHorizontal: 16,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '700' },
});
