import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { useTheme } from '../../theme';

type Props = { available: boolean; onTurnOn: () => void };

/** Shown until the user turns the coach on. Nothing is sent before that. */
export function CoachOptIn({ available, onTurnOn }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();

  return (
    <>
      <BodyText>{t('coach.intro')}</BodyText>
      <Card tone="soft" testID="coach-opt-in">
        <Text style={[styles.strong, { color: theme.text }]}>{t('coach.notTherapist')}</Text>
      </Card>
      <Card>
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
          {t('coach.whatIsSent')}
        </Text>
        <BodyText>{t('coach.sentList')}</BodyText>
        <BodyText>{t('coach.notSentList')}</BodyText>
        <BodyText>{t('coach.crisisFirst')}</BodyText>
      </Card>
      {available ? (
        <ActionButton testID="coach-turn-on" label={t('coach.turnOn')} onPress={onTurnOn} />
      ) : (
        <BodyText>{t('coach.unavailable')}</BodyText>
      )}
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 19, fontWeight: '700' },
  strong: { fontSize: 17, lineHeight: 26, fontWeight: '600' },
});
