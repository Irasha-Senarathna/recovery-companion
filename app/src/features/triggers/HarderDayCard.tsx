import { useRouter } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import type { Reason } from '../../ml/explain';
import { useTheme } from '../../theme';

/** Gentle note on a harder day: what often plays a part, and the user's plan. */
export function HarderDayCard({ reasons, testID }: { reasons: Reason[]; testID: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const named = reasons.map((r) => t(`triggers.reasons.${r}`));

  return (
    <Card tone="soft" testID={testID}>
      {/* Read as one item, so the caveat is never heard without the message. */}
      <View accessible style={styles.text}>
        <BodyText>{t('triggers.harderToday')}</BodyText>
        {named.length ? (
          <BodyText>
            {t('triggers.reasonsToday', { reasons: named.join(t('triggers.listSeparator')) })}
          </BodyText>
        ) : null}
        <Text style={[styles.note, { color: theme.textMuted }]}>{t('triggers.cardNote')}</Text>
      </View>
      <ActionButton
        testID="open-coping-plan"
        tone="soft"
        label={t('triggers.openPlan')}
        onPress={() => router.push('/coping-plan')}
      />
      <ActionButton
        testID="harder-day-talk"
        tone="plain"
        label={t('triggers.talk')}
        onPress={() => router.push('/help')}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  text: { gap: 8 },
  note: { fontSize: 15, lineHeight: 22 },
});
