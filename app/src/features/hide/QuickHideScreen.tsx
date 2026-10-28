import { Pressable, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText } from '../../components/BodyText';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useSession } from '../session/SessionProvider';

/**
 * A neutral screen with nothing personal on it. Press and hold to go back,
 * which always lands on the lock screen.
 */
export function QuickHideScreen() {
  const { t } = useTranslation();
  const { unhide } = useSession();

  return (
    <ScreenLayout title={t('hide.title')} testID="hidden-screen">
      <Pressable
        testID="hidden-return"
        accessibilityHint={t('hide.returnHint')}
        accessibilityActions={[{ name: 'longpress', label: t('hide.returnAction') }]}
        onAccessibilityAction={unhide}
        onLongPress={unhide}
        delayLongPress={800}
        style={styles.area}
      >
        <BodyText>{t('hide.empty')}</BodyText>
      </Pressable>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  area: { minHeight: 400 },
});
