import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Share, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { ScreenLayout } from '../../components/ScreenLayout';
import { formatInviteCode, type Invite } from '../../net/circleClient';
import { useTheme } from '../../theme';
import { CircleErrorText } from './CircleText';
import { useCircle } from './useCircle';

/** Makes a single-use, 24-hour code for one trusted person. */
export function InviteScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const circle = useCircle('member');
  const [invite, setInvite] = useState<Invite | null>(null);

  const make = async () => {
    const created = await circle.run((client, token) => client.createInvite(token));
    if (created) setInvite(created);
  };

  const code = invite ? formatInviteCode(invite.code) : null;

  return (
    <ScreenLayout title={t('invite.title')}>
      <BodyText>{t('invite.intro')}</BodyText>
      <CircleErrorText kind={circle.error} />
      {code ? (
        <>
          <Card tone="soft">
            <Text
              testID="invite-code"
              selectable
              // Read out letter by letter, so it can be passed on by voice.
              accessibilityLabel={t('invite.codeLabel', { spelled: code.split('').join(' ') })}
              style={[styles.code, { color: theme.text }]}
            >
              {code}
            </Text>
            <BodyText>{t('invite.expires')}</BodyText>
          </Card>
          <BodyText>{t('invite.steps')}</BodyText>
          <ActionButton
            testID="invite-share"
            tone="soft"
            label={t('invite.share')}
            onPress={() => Share.share({ message: t('invite.shareMessage', { code }) })}
          />
          <ActionButton
            testID="invite-new"
            tone="plain"
            label={t('invite.newCode')}
            disabled={circle.busy}
            onPress={make}
          />
        </>
      ) : (
        <ActionButton
          testID="invite-make"
          label={t('invite.make')}
          disabled={circle.busy || circle.phase !== 'on'}
          onPress={make}
        />
      )}
      <ActionButton
        testID="invite-done"
        tone="plain"
        label={t('invite.done')}
        onPress={() => router.back()}
      />
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  code: { fontSize: 34, fontWeight: '700', letterSpacing: 3, textAlign: 'center' },
});
