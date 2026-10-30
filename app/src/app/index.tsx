import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/ActionButton';
import { CalmScene } from '../components/illustrations/CalmScene';
import { ScreenLayout } from '../components/ScreenLayout';
import { getCheckIn, localDay } from '../features/checkin/checkinRepo';
import { useSession } from '../features/session/SessionProvider';
import { SosButton } from '../features/sos/SosButton';
import { useTheme } from '../theme';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const { settings, db } = useSession();
  const [doneToday, setDoneToday] = useState(false);

  // Re-checked whenever home comes back into view (e.g. after saving a check-in).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      if (db) getCheckIn(db, localDay()).then((today) => active && setDoneToday(!!today));
      return () => {
        active = false;
      };
    }, [db]),
  );

  return (
    <ScreenLayout
      title={t('home.title', { nickname: settings.nickname ?? '' })}
      hero={<CalmScene />}
    >
      <Text style={[styles.subtitle, { color: theme.textMuted }]}>{t('home.subtitle')}</Text>
      <SosButton onPress={() => router.push('/sos')} />
      <View style={styles.grid}>
        <ActionButton
          testID="open-checkin"
          tone="soft"
          label={doneToday ? t('home.checkinChange') : t('home.checkin')}
          onPress={() => router.push('/checkin')}
        />
        {doneToday ? (
          <Text testID="checkin-done-today" style={[styles.note, { color: theme.textMuted }]}>
            {t('home.checkinDone')}
          </Text>
        ) : null}
        <ActionButton
          testID="open-vault"
          tone="soft"
          label={t('home.reasons')}
          onPress={() => router.push('/vault')}
        />
        <ActionButton
          testID="open-progress"
          tone="soft"
          label={t('home.progress')}
          onPress={() => router.push('/progress')}
        />
        <ActionButton
          testID="open-settings"
          tone="plain"
          label={t('home.settings')}
          onPress={() => router.push('/settings')}
        />
      </View>
    </ScreenLayout>
  );
}

const styles = StyleSheet.create({
  subtitle: { fontSize: 18, lineHeight: 27, textAlign: 'center' },
  grid: { gap: 12 },
  note: { fontSize: 15, textAlign: 'center' },
});
