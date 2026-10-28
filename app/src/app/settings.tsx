import { Platform, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText } from '../components/BodyText';
import { DeleteAllButton } from '../components/DeleteAllButton';
import { LanguagePicker } from '../components/LanguagePicker';
import { ScreenLayout } from '../components/ScreenLayout';
import { ToggleRow } from '../components/ToggleRow';
import { useSession } from '../features/session/SessionProvider';
import { disableBiometricUnlock, enableBiometricUnlock } from '../platform/biometrics';
import { useTheme } from '../theme';

export default function SettingsScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const { settings, updateSettings, biometricsAvailable } = useSession();
  const heading = [styles.heading, { color: theme.text }];

  // Turning biometrics on needs a successful scan first, so it is known to work.
  const setBiometric = async (on: boolean) => {
    if (on && !(await enableBiometricUnlock(t('lock.biometricPrompt'), t('common.cancel')))) {
      return;
    }
    if (!on) await disableBiometricUnlock();
    await updateSettings({ biometricEnabled: on });
  };

  return (
    <ScreenLayout title={t('settings.title')}>
      <Text accessibilityRole="header" style={heading}>
        {t('settings.language')}
      </Text>
      <LanguagePicker
        onSelect={(language) => {
          i18n.changeLanguage(language);
          updateSettings({ language });
        }}
      />

      <Text accessibilityRole="header" style={heading}>
        {t('settings.security')}
      </Text>
      {biometricsAvailable ? (
        <ToggleRow
          testID="biometric-unlock"
          label={t('settings.biometric')}
          value={settings.biometricEnabled}
          onValueChange={setBiometric}
        />
      ) : null}
      <ToggleRow
        testID="shake-to-hide"
        label={t('settings.shakeToHide')}
        note={Platform.OS === 'web' ? t('common.phoneOnly') : undefined}
        value={settings.shakeToHide}
        onValueChange={(shakeToHide) => updateSettings({ shakeToHide })}
      />

      <Text accessibilityRole="header" style={heading}>
        {t('settings.data')}
      </Text>
      <BodyText>{t('settings.dataInfo')}</BodyText>
      <DeleteAllButton />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700' },
});
