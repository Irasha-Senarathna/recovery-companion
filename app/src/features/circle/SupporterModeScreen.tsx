import { useState } from 'react';
import { Platform, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { EmptyState } from '../../components/EmptyState';
import { Card } from '../../components/Card';
import { SafeTextInput } from '../../components/SafeTextInput';
import { ScreenLayout } from '../../components/ScreenLayout';
import { ToggleRow } from '../../components/ToggleRow';
import { isLanguage } from '../../i18n';
import { checkCode, cleanInviteCode } from '../../net/circleClient';
import { forgetPushToken, getPushToken } from '../../platform/push';
import { useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { MAX_LABEL_LENGTH, removeLabel, saveLabel } from './circleRepo';
import { CircleErrorText, formatWhen, SectionHeading } from './CircleText';
import { ConfirmAction } from '../../components/ConfirmAction';
import { useCircle, type Circle, type CircleLink } from './useCircle';

/** The same app, used by someone who supports a person in recovery. */
export function SupporterModeScreen() {
  const { t } = useTranslation();
  const circle = useCircle('supporter');

  return (
    <ScreenLayout title={t('supporter.title')}>
      <BodyText>{t('supporter.intro')}</BodyText>
      {circle.phase === 'unavailable' ? <BodyText>{t('circle.unavailable')}</BodyText> : null}
      <CircleErrorText kind={circle.error} />
      {circle.phase === 'on' ? <Supporting circle={circle} /> : null}
      {circle.phase === 'off' || circle.phase === 'on' ? <JoinForm circle={circle} /> : null}
      {circle.phase === 'on' ? (
        <ConfirmAction
          testID="supporter-leave"
          label={t('supporter.leave')}
          question={t('supporter.leaveConfirm')}
          confirmLabel={t('supporter.leaveYes')}
          disabled={circle.busy}
          onConfirm={circle.leave}
        />
      ) : null}
    </ScreenLayout>
  );
}

function Supporting({ circle }: { circle: Circle }) {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeading>{t('supporter.requests')}</SectionHeading>
      <Requests circle={circle} />
      <BodyText>{t('supporter.howTo')}</BodyText>
      <ActionButton
        testID="supporter-check"
        tone="soft"
        label={Platform.OS === 'web' ? t('supporter.checkWeb') : t('supporter.check')}
        disabled={circle.busy}
        onPress={circle.load}
      />
      <NotifyToggle circle={circle} />

      <SectionHeading>{t('supporter.people')}</SectionHeading>
      {circle.links.length === 0 ? (
        <EmptyState testID="supporter-people-empty" message={t('supporter.none')} />
      ) : null}
      {circle.links.map((link) => (
        <Person key={link.id} link={link} circle={circle} />
      ))}
    </>
  );
}

function Requests({ circle }: { circle: Circle }) {
  const { t } = useTranslation();
  if (circle.signals.length === 0) {
    return <EmptyState testID="supporter-requests-empty" message={t('supporter.noRequests')} />;
  }
  const names = new Map(circle.links.map((link) => [link.id, link.label]));
  return (
    <>
      {circle.signals.map((signal, index) => (
        <Card key={`${signal.linkId}-${signal.createdAt}`} tone="soft" testID={`request-${index}`}>
          <BodyText>
            {t('supporter.request', {
              name: names.get(signal.linkId) ?? t('circle.unnamed'),
              when: formatWhen(signal.createdAt, t),
            })}
          </BodyText>
        </Card>
      ))}
    </>
  );
}

function Person({ link, circle }: { link: CircleLink; circle: Circle }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useSession();
  const name = link.label ?? t('circle.unnamed');

  const stop = async () => {
    await circle.run((client, token) => client.revokeLink(token, link.id));
    if (db) await removeLabel(db, link.id);
  };

  return (
    <Card>
      <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
      <BodyText>
        {link.status === 'pending' ? t('supporter.waiting') : t('supporter.connected')}
      </BodyText>
      {link.status === 'pending' ? (
        <BodyText>{t('supporter.checkCode', { check: checkCode(link.id) })}</BodyText>
      ) : null}
      <ConfirmAction
        testID="stop-supporting"
        label={t('supporter.stop', { name })}
        question={t('supporter.stopConfirm', { name })}
        confirmLabel={t('supporter.stopYes')}
        disabled={circle.busy}
        onConfirm={stop}
      />
    </Card>
  );
}

function JoinForm({ circle }: { circle: Circle }) {
  const { t } = useTranslation();
  const { db } = useSession();
  const [code, setCode] = useState('');
  const [label, setLabel] = useState('');
  const ready = cleanInviteCode(code).length === 10 && label.trim() !== '';

  const join = async () => {
    const joined = await circle.run((client, token) => client.redeemInvite(token, code));
    if (!joined || !db) return;
    await saveLabel(db, 'supporter', joined.linkId, label);
    await circle.load();
    setCode('');
    setLabel('');
  };

  return (
    <>
      <SectionHeading>{t('supporter.add')}</SectionHeading>
      <SafeTextInput
        testID="join-code"
        label={t('supporter.codeLabel')}
        hint={t('supporter.codeHint')}
        value={code}
        maxLength={14}
        autoCapitalize="characters"
        onChangeText={setCode}
      />
      <SafeTextInput
        testID="join-label"
        label={t('supporter.nameLabel')}
        value={label}
        maxLength={MAX_LABEL_LENGTH}
        onChangeText={setLabel}
      />
      <ActionButton
        testID="join-submit"
        label={t('supporter.join')}
        disabled={circle.busy || !ready}
        onPress={join}
      />
    </>
  );
}

/** Push is opt-in: no token is fetched or sent until this is switched on. */
function NotifyToggle({ circle }: { circle: Circle }) {
  const { t, i18n } = useTranslation();
  const { settings, updateSettings } = useSession();
  const [unavailable, setUnavailable] = useState(false);
  const isWeb = Platform.OS === 'web';

  const setNotify = async (on: boolean) => {
    if (on) {
      const pushToken = await getPushToken(t('notifications.circleChannelName'));
      if (!pushToken) return setUnavailable(true);
      const lang = isLanguage(i18n.language) ? i18n.language : 'en';
      const done = await circle.run(async (client, token) => {
        await client.setPushToken(token, pushToken, lang);
        return true;
      });
      if (done) await updateSettings({ circleNotify: true });
      return;
    }
    await circle.run((client, token) => client.removePushToken(token));
    await forgetPushToken().catch(() => {});
    await updateSettings({ circleNotify: false });
  };

  return (
    <>
      <ToggleRow
        testID="supporter-notify"
        label={t('supporter.notify')}
        note={isWeb ? t('common.phoneOnly') : t('supporter.notifyInfo')}
        value={settings.circleNotify}
        disabled={isWeb || circle.busy}
        onValueChange={setNotify}
      />
      {unavailable ? <BodyText>{t('supporter.notifyUnavailable')}</BodyText> : null}
    </>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 19, fontWeight: '700' },
});
