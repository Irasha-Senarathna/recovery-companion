import { useTranslation } from 'react-i18next';
import { ScreenLayout } from '../components/ScreenLayout';

/** Shown while the encrypted store opens, so help is reachable even then. */
export default function LoadingScreen() {
  const { t } = useTranslation();
  return <ScreenLayout title={t('common.loading')} />;
}
