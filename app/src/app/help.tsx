import { useTranslation } from 'react-i18next';
import { BodyText } from '../components/BodyText';
import { ScreenLayout } from '../components/ScreenLayout';

// Milestone 2 replaces the placeholder with entries from content/helplines.json.
export default function HelpScreen() {
  const { t } = useTranslation();

  return (
    <ScreenLayout title={t('help.title')}>
      <BodyText>{t('help.emergency')}</BodyText>
      <BodyText>{t('help.notSetUp')}</BodyText>
    </ScreenLayout>
  );
}
