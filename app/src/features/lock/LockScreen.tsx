import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { DeleteAllButton } from '../../components/DeleteAllButton';
import { SafeTextInput } from '../../components/SafeTextInput';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useSession } from '../session/SessionProvider';
import { isValidPin } from './pin';

export function LockScreen() {
  const { t } = useTranslation();
  const session = useSession();
  const [pin, setPin] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const checking = useRef(false);

  const unlock = async () => {
    // One check at a time, so every failed attempt is counted.
    if (checking.current || !isValidPin(pin)) return;
    checking.current = true;
    setBusy(true);
    try {
      const result = await session.unlockWithPin(pin);
      if (result.status === 'wrong') setMessage(t('lock.wrongPin'));
      if (result.status === 'blocked') setMessage(t('lock.blocked'));
      if (result.status === 'wait') {
        const seconds = Math.max(1, Math.ceil((result.retryAt - Date.now()) / 1000));
        setMessage(t('lock.wait', { seconds }));
      }
    } finally {
      checking.current = false;
      setBusy(false);
      setPin('');
    }
  };

  const showBiometric = session.settings.biometricEnabled && session.biometricsAvailable;

  return (
    <ScreenLayout title={t('lock.title')}>
      <SafeTextInput
        testID="pin-input"
        label={t('lock.pinLabel')}
        value={pin}
        onChangeText={setPin}
        error={message}
        secureTextEntry
        keyboardType="number-pad"
        maxLength={6}
        autoComplete="off"
        onSubmitEditing={unlock}
      />
      <ActionButton
        testID="unlock"
        label={t('lock.unlock')}
        disabled={busy || !isValidPin(pin)}
        onPress={unlock}
      />
      {showBiometric ? (
        <ActionButton
          testID="unlock-biometric"
          tone="plain"
          label={t('lock.biometric')}
          onPress={() => session.unlockWithBiometrics(t('lock.biometricPrompt'))}
        />
      ) : null}
      <BodyText>{t('lock.forgotTitle')}</BodyText>
      <BodyText>{t('lock.forgotInfo')}</BodyText>
      <DeleteAllButton />
    </ScreenLayout>
  );
}
