import { useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import type { CircleErrorKind } from '../../net/circleClient';
import { useTheme } from '../../theme';
import type { Circle } from './useCircle';

/**
 * "Ask my circle to check in". Shown inline (not as a modal) so the help
 * button stays visible. Asks for consent every time, showing the exact text
 * the supporters will get, before anything is sent. A supporter may not see a
 * request at once, so every outcome also offers help that does not wait.
 */
export function ConsentSheet({ circle }: { circle: Circle }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [step, setStep] = useState<'idle' | 'confirm' | 'sent'>('idle');
  const [remaining, setRemaining] = useState<number | null>(null);
  const [failed, setFailed] = useState<CircleErrorKind | null>(null);

  const send = async () => {
    setFailed(null);
    const result = await circle.run((client, token) => client.sendSignal(token), setFailed);
    setStep(result ? 'sent' : 'idle');
    if (result) setRemaining(result.remainingToday);
  };

  if (step === 'confirm') {
    return (
      <Card tone="soft" testID="circle-consent">
        <Text accessibilityRole="header" style={[styles.title, { color: theme.text }]}>
          {t('circle.consentTitle')}
        </Text>
        <BodyText>{t('circle.consentBody')}</BodyText>
        <Text style={[styles.quote, { color: theme.text, borderColor: theme.border }]}>
          {t('notifications.circleBody')}
        </Text>
        <BodyText>{t('circle.consentNot')}</BodyText>
        <ActionButton
          testID="circle-ask-send"
          label={t('circle.send')}
          disabled={circle.busy}
          onPress={send}
        />
        <ActionButton
          testID="circle-ask-cancel"
          tone="plain"
          label={t('common.cancel')}
          onPress={() => setStep('idle')}
        />
      </Card>
    );
  }

  const atLimit = failed === 'dailyLimit' || remaining === 0;
  return (
    <>
      {step === 'sent' ? (
        <Card tone="soft" testID="circle-ask-sent">
          <Text accessibilityLiveRegion="polite" style={[styles.title, { color: theme.text }]}>
            {t('circle.sent')}
          </Text>
          {remaining !== null ? (
            <BodyText>{t('circle.remaining', { count: remaining })}</BodyText>
          ) : null}
          <ReachOutNow intro={t('circle.whileYouWait')} />
        </Card>
      ) : null}
      {failed ? (
        <Card tone="soft" testID="circle-ask-failed">
          <ReachOutNow
            intro={failed === 'dailyLimit' ? t('circle.errors.dailyLimit') : t('circle.sendFailed')}
          />
        </Card>
      ) : null}
      {atLimit ? null : (
        <ActionButton
          testID="circle-ask"
          label={t('circle.ask')}
          onPress={() => {
            circle.setError(null);
            setFailed(null);
            setStep('confirm');
          }}
        />
      )}
    </>
  );
}

/** Help that does not depend on the circle answering. */
export function ReachOutNow({ intro }: { intro: string }) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  return (
    <>
      <Text accessibilityLiveRegion="polite" style={[styles.body, { color: theme.text }]}>
        {intro}
      </Text>
      <ActionButton
        testID="reach-help"
        tone="danger"
        label={t('circle.reachHelp')}
        onPress={() => router.push('/help')}
      />
      <ActionButton
        testID="reach-sos"
        tone="soft"
        label={t('circle.reachSos')}
        onPress={() => router.push('/sos')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 19, fontWeight: '700' },
  quote: { fontSize: 18, fontStyle: 'italic', borderLeftWidth: 3, paddingLeft: 12 },
  body: { fontSize: 17, lineHeight: 26 },
});
