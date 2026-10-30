import { useState } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { OptionButton } from '../../components/OptionButton';
import { ToggleRow } from '../../components/ToggleRow';
import { requestNotificationPermission } from '../../platform/notifications';
import { useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { formatTime, shiftTime, syncReminder, type ReminderTime } from './reminder';

const isWeb = Platform.OS === 'web';

/** Turn the daily check-in reminder on or off and pick its time. */
export function ReminderSettings() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings, updateSettings } = useSession();
  const [denied, setDenied] = useState(false);
  const [simulated, setSimulated] = useState(false);
  const time = { hour: settings.reminderHour, minute: settings.reminderMinute };

  const setEnabled = async (on: boolean) => {
    if (on && !(await requestNotificationPermission())) {
      setDenied(true);
      return;
    }
    setDenied(false);
    await updateSettings({ reminderEnabled: on });
    await syncReminder({ ...settings, reminderEnabled: on }, t);
  };

  const move = async (minutes: number) => {
    const next: ReminderTime = shiftTime(time, minutes);
    await updateSettings({ reminderHour: next.hour, reminderMinute: next.minute });
    await syncReminder({ ...settings, reminderHour: next.hour, reminderMinute: next.minute }, t);
  };

  return (
    <>
      <ToggleRow
        testID="reminder-enabled"
        label={t('settings.reminder')}
        note={isWeb ? t('common.phoneOnly') : undefined}
        value={settings.reminderEnabled}
        onValueChange={setEnabled}
      />
      {denied ? (
        <Text testID="reminder-denied" style={{ color: theme.text }}>
          {t('settings.reminderDenied')}
        </Text>
      ) : null}
      {settings.reminderEnabled ? (
        <>
          <Text
            accessibilityLabel={t('settings.reminderAt', { time: formatTime(time) })}
            style={[styles.time, { color: theme.text }]}
          >
            {formatTime(time)}
          </Text>
          <View style={styles.row}>
            <OptionButton label={t('settings.hourEarlier')} onPress={() => move(-60)} />
            <OptionButton label={t('settings.hourLater')} onPress={() => move(60)} />
          </View>
          <View style={styles.row}>
            <OptionButton label={t('settings.minutesEarlier')} onPress={() => move(-15)} />
            <OptionButton
              testID="reminder-later"
              label={t('settings.minutesLater')}
              onPress={() => move(15)}
            />
          </View>
          <BodyText>{t('settings.reminderPreview')}</BodyText>
          <Card tone="soft">
            <Text style={[styles.title, { color: theme.text }]}>
              {t('notifications.reminderTitle')}
            </Text>
            <BodyText>{t('notifications.reminderBody')}</BodyText>
          </Card>
          <Text testID="reminder-app-name" style={[styles.note, { color: theme.textMuted }]}>
            {t('settings.reminderAppName')}
          </Text>
          {isWeb ? (
            <>
              <OptionButton
                testID="reminder-simulate"
                label={t('settings.simulateNotification')}
                onPress={() => setSimulated(true)}
              />
              {simulated ? <BodyText>{t('settings.simulatedNotification')}</BodyText> : null}
            </>
          ) : null}
        </>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  time: { fontSize: 34, fontWeight: '700', textAlign: 'center', letterSpacing: -0.6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, justifyContent: 'center' },
  title: { fontSize: 17, fontWeight: '700' },
  note: { fontSize: 15, lineHeight: 22 },
});
