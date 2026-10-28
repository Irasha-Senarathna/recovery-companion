import { useRouter } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { BodyText } from '../components/BodyText';
import { OptionButton } from '../components/OptionButton';
import { ScreenLayout } from '../components/ScreenLayout';
import { useSession } from '../features/session/SessionProvider';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const { settings } = useSession();

  return (
    <ScreenLayout title={t('home.title', { nickname: settings.nickname ?? '' })}>
      <BodyText>{t('home.subtitle')}</BodyText>
      <OptionButton
        testID="open-settings"
        label={t('home.settings')}
        onPress={() => router.push('/settings')}
      />
    </ScreenLayout>
  );
}
