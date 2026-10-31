import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { ScreenLayout } from '../../components/ScreenLayout';
import { isLanguage } from '../../i18n';
import { useTheme } from '../../theme';
import type { MarkdownBlock } from '../../utils/markdown';
import { loadFirstVisit } from './firstVisit';

/** "What happens at your first visit?", from content/first_visit*.md. */
export function FirstVisitGuide() {
  const { t, i18n } = useTranslation();
  const router = useRouter();
  const language = isLanguage(i18n.language) ? i18n.language : 'en';
  const guide = loadFirstVisit(language);

  return (
    <ScreenLayout title={guide.title || t('finder.firstVisit')} testID="first-visit-screen">
      {guide.blocks.map((block, i) => (
        <GuideBlock key={i} block={block} />
      ))}
      <ActionButton
        testID="first-visit-help"
        tone="danger"
        label={t('help.button')}
        hint={t('help.buttonHint')}
        onPress={() => router.push('/help')}
      />
      <ActionButton
        testID="first-visit-back"
        tone="plain"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/finder'))}
      />
    </ScreenLayout>
  );
}

function GuideBlock({ block }: { block: MarkdownBlock }) {
  const theme = useTheme();
  if (block.kind === 'heading') {
    return (
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
        {block.text}
      </Text>
    );
  }
  if (block.kind === 'bullet') {
    return (
      <View style={styles.bullet}>
        <View style={[styles.dot, { backgroundColor: theme.primary }]} />
        <View style={styles.bulletText}>
          <BodyText>{block.text}</BodyText>
        </View>
      </View>
    );
  }
  return <BodyText>{block.text}</BodyText>;
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2, marginTop: 8 },
  bullet: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  dot: { width: 8, height: 8, borderRadius: 4, marginTop: 9 },
  bulletText: { flex: 1 },
});
