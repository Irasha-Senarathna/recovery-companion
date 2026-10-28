import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { LanguagePicker } from '../../components/LanguagePicker';
import { SafeTextInput } from '../../components/SafeTextInput';
import type { Language } from '../../i18n';
import { useTheme } from '../../theme';
import { isValidPin, isWeakPin } from '../lock/pin';
import { loadDisclaimer } from './disclaimer';

export const MAX_NICKNAME = 30;

export function LanguageStep({
  onSelect,
  onNext,
}: {
  onSelect: (l: Language) => void;
  onNext: () => void;
}) {
  const { t } = useTranslation();
  return (
    <>
      <Heading>{t('onboarding.languageTitle')}</Heading>
      <LanguagePicker onSelect={onSelect} />
      <ActionButton testID="onboarding-next" label={t('common.continue')} onPress={onNext} />
    </>
  );
}

export function DisclaimerStep({ language, onNext }: { language: Language; onNext: () => void }) {
  const { t } = useTranslation();
  return (
    <>
      {language !== 'en' ? (
        <>
          <BodyText>{t('help.emergency')}</BodyText>
          <BodyText>{t('onboarding.translationNote')}</BodyText>
        </>
      ) : null}
      {loadDisclaimer().map((block, i) =>
        block.kind === 'heading' ? (
          <Heading key={i}>{block.text}</Heading>
        ) : (
          <BodyText key={i}>{block.text}</BodyText>
        ),
      )}
      <ActionButton testID="disclaimer-agree" label={t('onboarding.agree')} onPress={onNext} />
    </>
  );
}

export function NicknameStep({ onNext }: { onNext: (nickname: string) => void }) {
  const { t } = useTranslation();
  const [nickname, setNickname] = useState('');
  const [error, setError] = useState<string | null>(null);

  const next = () => {
    const clean = nickname.trim();
    if (!clean || clean.length > MAX_NICKNAME) return setError(t('onboarding.nicknameInvalid'));
    onNext(clean);
  };

  return (
    <>
      <Heading>{t('onboarding.nicknameTitle')}</Heading>
      <SafeTextInput
        testID="nickname-input"
        label={t('onboarding.nicknameLabel')}
        hint={t('onboarding.nicknameHint')}
        error={error}
        value={nickname}
        onChangeText={setNickname}
        maxLength={MAX_NICKNAME}
        autoComplete="off"
        autoCorrect={false}
      />
      <ActionButton testID="onboarding-next" label={t('common.continue')} onPress={next} />
    </>
  );
}

export function PinStep({ onFinish }: { onFinish: (pin: string) => Promise<void> }) {
  const { t } = useTranslation();
  const [pin, setPin] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const finish = async () => {
    if (!isValidPin(pin)) return setError(t('onboarding.pinInvalid'));
    if (isWeakPin(pin)) return setError(t('onboarding.pinWeak'));
    if (pin !== confirm) {
      setConfirm('');
      return setError(t('onboarding.pinMismatch'));
    }
    setBusy(true);
    await onFinish(pin);
  };

  const pinProps = {
    secureTextEntry: true,
    keyboardType: 'number-pad',
    maxLength: 6,
    autoComplete: 'off',
  } as const;

  return (
    <>
      <Heading>{t('onboarding.pinTitle')}</Heading>
      <BodyText>{t('onboarding.pinInfo')}</BodyText>
      <SafeTextInput
        testID="pin-new"
        label={t('onboarding.pinLabel')}
        value={pin}
        onChangeText={setPin}
        {...pinProps}
      />
      <SafeTextInput
        testID="pin-confirm"
        label={t('onboarding.pinConfirmLabel')}
        value={confirm}
        onChangeText={setConfirm}
        error={error}
        {...pinProps}
      />
      <ActionButton
        testID="onboarding-finish"
        label={t('onboarding.finish')}
        disabled={busy}
        onPress={finish}
      />
    </>
  );
}

function Heading({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700' },
});
