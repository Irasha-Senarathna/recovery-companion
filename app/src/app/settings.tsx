import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { OptionButton } from '../components/OptionButton';
import { ScreenLayout } from '../components/ScreenLayout';
import { LANGUAGES } from '../i18n';
import { useTheme } from '../theme';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();

  return (
    <ScreenLayout title={t('settings.title')}>
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
        {t('settings.language')}
      </Text>
      {LANGUAGES.map((lang) => (
        <OptionButton
          key={lang}
          testID={`language-${lang}`}
          label={t(`settings.languages.${lang}`)}
          selected={i18n.language === lang}
          onPress={() => i18n.changeLanguage(lang)}
        />
      ))}
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700' },
});
