import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import appJson from '../../../app.json';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useTheme } from '../../theme';
import { loadDisclaimer } from '../onboarding/disclaimer';

const PRIVACY_POINTS = ['phone', 'leave', 'circle', 'coach', 'calls', 'tracking', 'control'] as const;

/** The disclaimer the user agreed to, and what this app does with their data, in plain words. */
export function AboutScreen() {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const muted = [styles.note, { color: theme.textMuted }];

  return (
    <ScreenLayout title={t('about.title')}>
      {i18n.language !== 'en' ? (
        <Text testID="about-translation-note" style={muted}>
          {t('onboarding.translationNote')}
        </Text>
      ) : null}
      <Card>
        {loadDisclaimer().map((block, i) =>
          block.kind === 'heading' ? (
            <Heading key={i}>{block.text}</Heading>
          ) : (
            <BodyText key={i}>{block.text}</BodyText>
          ),
        )}
      </Card>

      <Card tone="soft" testID="about-privacy">
        <Heading>{t('about.privacyTitle')}</Heading>
        {PRIVACY_POINTS.map((point) => (
          <View key={point} style={styles.point}>
            <View
              style={[styles.dot, { backgroundColor: theme.primary }]}
              accessibilityElementsHidden
              importantForAccessibility="no-hide-descendants"
            />
            <View style={styles.pointText}>
              <BodyText>{t(`about.points.${point}`)}</BodyText>
            </View>
          </View>
        ))}
      </Card>

      <Text testID="about-app-name" style={muted}>
        {t('about.appName', { name: appJson.expo.name })}
      </Text>
      <Text testID="about-version" style={muted}>
        {t('about.version', { version: appJson.expo.version })}
      </Text>
    </ScreenLayout>
  );
}

function Heading({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  point: { flexDirection: 'row', gap: 12 },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 9 },
  pointText: { flex: 1 },
  note: { fontSize: 15, lineHeight: 22 },
});
