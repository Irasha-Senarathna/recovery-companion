import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BodyText } from '../components/BodyText';
import { OptionButton } from '../components/OptionButton';
import { ScreenLayout } from '../components/ScreenLayout';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();

  return (
    <ScreenLayout title={t('home.title')}>
      <BodyText>{t('home.subtitle')}</BodyText>
      <OptionButton
        testID="open-settings"
        label={t('home.settings')}
        onPress={() => router.push('/settings')}
      />
    </ScreenLayout>
  );
}
