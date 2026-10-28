import { useTranslation } from 'react-i18next';
import { BodyText } from '../components/BodyText';
import { DeleteAllButton } from '../components/DeleteAllButton';
import { ScreenLayout } from '../components/ScreenLayout';

/** Shown when the encrypted database cannot be opened (e.g. the key is gone). */
export default function ProblemScreen() {
  const { t } = useTranslation();

  return (
    <ScreenLayout title={t('problem.title')}>
      <BodyText>{t('problem.info')}</BodyText>
      <DeleteAllButton />
    </ScreenLayout>
  );
}
