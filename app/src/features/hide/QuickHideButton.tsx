import { Pressable, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { MIN_TAP, useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';

/** One tap to a neutral screen. Shown only while the app is unlocked. */
export function QuickHideButton() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { status, hidden, hide } = useSession();
  if (status !== 'unlocked' || hidden) return null;

  return (
    <Pressable
      testID="quick-hide"
      accessibilityRole="button"
      accessibilityLabel={t('hide.button')}
      accessibilityHint={t('hide.buttonHint')}
      onPress={hide}
      style={({ pressed }) => [
        styles.button,
        { borderColor: theme.border, backgroundColor: theme.surface, opacity: pressed ? 0.8 : 1 },
      ]}
    >
      <Text style={[styles.label, { color: theme.text }]}>{t('hide.button')}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: MIN_TAP,
    minWidth: MIN_TAP,
    paddingHorizontal: 14,
    borderRadius: 24,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
