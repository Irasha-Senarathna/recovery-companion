import { useState } from 'react';
import { Platform, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ToggleRow } from '../../components/ToggleRow';
import { requestNotificationPermission } from '../../platform/notifications';
import { useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { refreshNudge } from './earlyWarning';

/** Turn the harder-day heads-up on or off (off until the user chooses it). */
export function NudgeToggle() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { db, settings, updateSettings } = useSession();
  const [denied, setDenied] = useState(false);

  const setEnabled = async (on: boolean) => {
    if (on && !(await requestNotificationPermission())) {
      setDenied(true);
      return;
    }
    setDenied(false);
    await updateSettings({ nudgesEnabled: on });
    if (db) {
      await refreshNudge({
        db,
        settings: { ...settings, nudgesEnabled: on },
        updateSettings,
        t,
      }).catch(() => {});
    }
  };

  return (
    <>
      <ToggleRow
        testID="nudges-enabled"
        label={t('triggers.nudges')}
        note={Platform.OS === 'web' ? t('common.phoneOnly') : t('triggers.nudgesInfo')}
        value={settings.nudgesEnabled}
        onValueChange={setEnabled}
      />
      {denied ? <Text style={{ color: theme.text }}>{t('settings.reminderDenied')}</Text> : null}
    </>
  );
}
