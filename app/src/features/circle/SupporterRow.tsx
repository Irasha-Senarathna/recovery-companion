import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { SafeTextInput } from '../../components/SafeTextInput';
import { checkCode } from '../../net/circleClient';
import { useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { MAX_LABEL_LENGTH, removeLabel, saveLabel } from './circleRepo';
import { ConfirmAction } from './ConfirmAction';
import type { Circle, CircleLink } from './useCircle';

/** One supporter, as the member sees them: approve a newcomer, or remove someone. */
export function SupporterRow({ link, circle }: { link: CircleLink; circle: Circle }) {
  return link.status === 'pending' ? (
    <PendingSupporter link={link} circle={circle} />
  ) : (
    <ActiveSupporter link={link} circle={circle} />
  );
}

function PendingSupporter({ link, circle }: { link: CircleLink; circle: Circle }) {
  const { t } = useTranslation();
  const { db } = useSession();
  const [label, setLabel] = useState('');

  const approve = async () => {
    if (!db) return;
    // The name is saved on this phone only; the server just hears "approve".
    await saveLabel(db, 'member', link.id, label);
    await circle.run((client, token) => client.approveLink(token, link.id));
  };

  return (
    <Card tone="soft">
      <BodyText>{t('circle.pending')}</BodyText>
      <BodyText>{t('circle.pendingHint', { check: checkCode(link.id) })}</BodyText>
      <SafeTextInput
        testID="pending-label"
        label={t('circle.labelLabel')}
        value={label}
        maxLength={MAX_LABEL_LENGTH}
        onChangeText={setLabel}
      />
      <ActionButton
        testID="pending-approve"
        label={t('circle.approve')}
        disabled={circle.busy || label.trim() === ''}
        onPress={approve}
      />
      <ActionButton
        testID="pending-decline"
        tone="plain"
        label={t('circle.decline')}
        disabled={circle.busy}
        onPress={() => circle.run((client, token) => client.revokeLink(token, link.id))}
      />
    </Card>
  );
}

function ActiveSupporter({ link, circle }: { link: CircleLink; circle: Circle }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db } = useSession();
  const name = link.label ?? t('circle.unnamed');

  const remove = async () => {
    await circle.run((client, token) => client.revokeLink(token, link.id));
    if (db) await removeLabel(db, link.id);
  };

  return (
    <Card>
      <Text style={[styles.name, { color: theme.text }]}>{name}</Text>
      <ConfirmAction
        testID="remove-supporter"
        label={t('circle.remove', { name })}
        question={t('circle.removeConfirm', { name })}
        confirmLabel={t('circle.removeYes')}
        disabled={circle.busy}
        onConfirm={remove}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  name: { fontSize: 19, fontWeight: '700' },
});
