import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from './ActionButton';
import { BodyText } from './BodyText';

type Props = {
  label: string;
  question: string;
  confirmLabel: string;
  onConfirm: () => Promise<unknown>;
  disabled?: boolean;
  testID: string;
};

/** A plain button that asks once more before doing something that cannot be undone. */
export function ConfirmAction({
  label,
  question,
  confirmLabel,
  onConfirm,
  disabled,
  testID,
}: Props) {
  const { t } = useTranslation();
  const [asking, setAsking] = useState(false);

  if (!asking) {
    return (
      <ActionButton
        testID={testID}
        tone="plain"
        label={label}
        disabled={disabled}
        onPress={() => setAsking(true)}
      />
    );
  }
  return (
    <>
      <BodyText>{question}</BodyText>
      <ActionButton
        testID={`${testID}-confirm`}
        tone="danger"
        label={confirmLabel}
        disabled={disabled}
        onPress={async () => {
          await onConfirm();
          setAsking(false);
        }}
      />
      <ActionButton
        testID={`${testID}-cancel`}
        tone="plain"
        label={t('common.cancel')}
        onPress={() => setAsking(false)}
      />
    </>
  );
}
