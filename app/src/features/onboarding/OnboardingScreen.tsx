import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ScreenLayout } from '../../components/ScreenLayout';
import { isLanguage, type Language } from '../../i18n';
import { useSession } from '../session/SessionProvider';
import { DisclaimerStep, LanguageStep, NicknameStep, PinStep } from './steps';

type Step = 'language' | 'disclaimer' | 'nickname' | 'pin';

/** Language first, so the disclaimer and everything after are understood. */
export function OnboardingScreen() {
  const { t, i18n } = useTranslation();
  const { completeOnboarding } = useSession();
  const [step, setStep] = useState<Step>('language');
  const [nickname, setNickname] = useState('');
  const language: Language = isLanguage(i18n.language) ? i18n.language : 'en';

  const titles: Record<Step, string> = {
    language: t('onboarding.languageTitle'),
    disclaimer: t('onboarding.disclaimerTitle'),
    nickname: t('onboarding.nicknameTitle'),
    pin: t('onboarding.pinTitle'),
  };

  return (
    <ScreenLayout title={titles[step]}>
      {step === 'language' ? (
        <LanguageStep
          onSelect={(lang) => i18n.changeLanguage(lang)}
          onNext={() => setStep('disclaimer')}
        />
      ) : null}
      {step === 'disclaimer' ? (
        <DisclaimerStep language={language} onNext={() => setStep('nickname')} />
      ) : null}
      {step === 'nickname' ? (
        <NicknameStep
          onNext={(name) => {
            setNickname(name);
            setStep('pin');
          }}
        />
      ) : null}
      {step === 'pin' ? (
        <PinStep onFinish={(pin) => completeOnboarding({ nickname, pin, language })} />
      ) : null}
    </ScreenLayout>
  );
}
