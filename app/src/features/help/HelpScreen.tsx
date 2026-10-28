import { useLocalSearchParams, useRouter } from 'expo-router';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useTheme } from '../../theme';
import { HelplineList } from './HelplineList';
import { loadHelplines } from './helplines';

/** Reachable from every screen, locked or not. Holds no personal data. */
export function HelpScreen() {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const { reason } = useLocalSearchParams<{ reason?: string }>();

  return (
    <ScreenLayout title={t('help.title')} testID="help-screen">
      {reason === 'crisis' ? (
        <Text
          testID="crisis-message"
          accessibilityLiveRegion="assertive"
          style={[styles.crisis, { color: theme.text, borderColor: theme.help }]}
        >
          {t('help.crisis')}
        </Text>
      ) : null}
      <BodyText>{t('help.emergency')}</BodyText>
      <HelplineList entries={loadHelplines()} />
      <ActionButton
        testID="help-back"
        tone="plain"
        label={t('common.back')}
        // Opened directly (e.g. a link): the guards send '/' to the right screen.
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  crisis: { fontSize: 19, lineHeight: 28, fontWeight: '700', borderLeftWidth: 6, paddingLeft: 12 },
});
