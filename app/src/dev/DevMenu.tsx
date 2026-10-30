import { useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../components/ActionButton';
import { BodyText } from '../components/BodyText';
import { Card } from '../components/Card';
import type { Database } from '../storage/types';
import { useTheme } from '../theme';
import { clearDemoData, loadDemoData } from './demoData';

/** Load or clear made-up data. Rendered only when `__DEV__` is true. */
export function DevMenu({ db }: { db: Database }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [status, setStatus] = useState<string | null>(null);

  const load = async () => {
    const result = await loadDemoData(db);
    setStatus(t('dev.loaded', result));
  };

  const clear = async () => {
    await clearDemoData(db);
    setStatus(t('dev.cleared'));
  };

  return (
    <Card tone="soft">
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
        {t('dev.title')}
      </Text>
      <BodyText>{t('dev.info')}</BodyText>
      <ActionButton testID="dev-load-demo" tone="plain" label={t('dev.load')} onPress={load} />
      <ActionButton testID="dev-clear-demo" tone="plain" label={t('dev.clear')} onPress={clear} />
      {status ? <BodyText>{status}</BodyText> : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 18, fontWeight: '700' },
});
