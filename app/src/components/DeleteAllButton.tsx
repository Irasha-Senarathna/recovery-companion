import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSession } from '../features/session/SessionProvider';
import { ActionButton } from './ActionButton';
import { BodyText } from './BodyText';

/** Delete-all with one confirmation step (2 taps), usable from any screen. */
export function DeleteAllButton() {
  const { t } = useTranslation();
  const { deleteEverything } = useSession();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState<string[]>([]);
  const [circleQueued, setCircleQueued] = useState(false);

  const confirm = async () => {
    setBusy(true);
    const result = await deleteEverything();
    setBusy(false);
    setConfirming(false);
    setFailed(result.failed);
    setCircleQueued(!!result.circleQueued);
  };

  if (!confirming) {
    return (
      <>
        {failed.length > 0 ? (
          <BodyText>
            {failed.includes('dbKey') ? t('deleteAll.incomplete') : t('deleteAll.partial')}
          </BodyText>
        ) : null}
        {circleQueued ? <BodyText>{t('deleteAll.circleQueued')}</BodyText> : null}
        <ActionButton
          testID="delete-all"
          tone="plain"
          label={t('deleteAll.button')}
          onPress={() => setConfirming(true)}
        />
      </>
    );
  }

  return (
    <>
      <BodyText>{t('deleteAll.explain')}</BodyText>
      <ActionButton
        testID="delete-all-confirm"
        tone="danger"
        label={t('deleteAll.confirm')}
        disabled={busy}
        onPress={confirm}
      />
      <ActionButton
        testID="delete-all-cancel"
        tone="plain"
        label={t('common.cancel')}
        disabled={busy}
        onPress={() => setConfirming(false)}
      />
    </>
  );
}
