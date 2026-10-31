import { useRouter } from 'expo-router';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { ScreenLayout } from '../../components/ScreenLayout';
import { MAX_SUPPORTERS } from './limits';
import { CircleErrorText, SectionHeading, SharingSummary } from './CircleText';
import { ConfirmAction } from '../../components/ConfirmAction';
import { ConsentSheet } from './ConsentSheet';
import { SupporterRow } from './SupporterRow';
import { useCircle, type Circle } from './useCircle';

/** The member's support circle: up to 3 trusted people and "please check in". */
export function CircleScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const circle = useCircle('member');

  return (
    <ScreenLayout title={t('circle.title')}>
      <BodyText>{t('circle.intro')}</BodyText>
      {circle.phase === 'unavailable' ? <BodyText>{t('circle.unavailable')}</BodyText> : null}
      {circle.phase === 'off' ? (
        <>
          <SharingSummary />
          <CircleErrorText kind={circle.error} />
          <ActionButton
            testID="circle-turn-on"
            label={t('circle.turnOn')}
            disabled={circle.busy}
            onPress={circle.turnOn}
          />
        </>
      ) : null}
      {circle.phase === 'on' ? <MemberCircle circle={circle} /> : null}
      <ActionButton
        testID="open-supporter"
        tone="plain"
        label={t('circle.supporterLink')}
        onPress={() => router.push('/supporter')}
      />
    </ScreenLayout>
  );
}

function MemberCircle({ circle }: { circle: Circle }) {
  const { t } = useTranslation();
  const router = useRouter();
  const [queued, setQueued] = useState(false);
  const approved = circle.links.some((link) => link.status === 'active');

  return (
    <>
      <CircleErrorText kind={circle.error} />
      {approved ? (
        <ConsentSheet circle={circle} />
      ) : (
        <BodyText>{t('circle.askNeedsSupporter')}</BodyText>
      )}

      <SectionHeading>{t('circle.supporters')}</SectionHeading>
      {circle.links.length === 0 ? <BodyText>{t('circle.noSupporters')}</BodyText> : null}
      {circle.links.map((link) => (
        <SupporterRow key={link.id} link={link} circle={circle} />
      ))}
      {circle.links.length < MAX_SUPPORTERS ? (
        <ActionButton
          testID="circle-invite"
          tone="soft"
          label={t('circle.invite')}
          onPress={() => router.push('/circle-invite')}
        />
      ) : (
        <BodyText>{t('circle.full')}</BodyText>
      )}

      <SharingSummary />
      {queued ? <BodyText>{t('circle.queued')}</BodyText> : null}
      <ConfirmAction
        testID="circle-turn-off"
        label={t('circle.turnOff')}
        question={t('circle.turnOffConfirm')}
        confirmLabel={t('circle.turnOffYes')}
        disabled={circle.busy}
        onConfirm={async () => setQueued((await circle.leave()) === 'queued')}
      />
    </>
  );
}
