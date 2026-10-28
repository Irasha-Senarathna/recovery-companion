import { useTranslation } from 'react-i18next';
import { LANGUAGES, type Language } from '../i18n';
import { OptionButton } from './OptionButton';

export function LanguagePicker({ onSelect }: { onSelect: (lang: Language) => void }) {
  const { t, i18n } = useTranslation();
  return (
    <>
      {LANGUAGES.map((lang) => (
        <OptionButton
          key={lang}
          testID={`language-${lang}`}
          label={t(`settings.languages.${lang}`)}
          selected={i18n.language === lang}
          onPress={() => onSelect(lang)}
        />
      ))}
    </>
  );
}
