import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useTheme } from '../theme';
import { isWebDemo } from './isWebDemo';

export function WebDemoBanner() {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!isWebDemo()) return null;

  return (
    <View testID="web-demo-banner" style={[styles.banner, { backgroundColor: theme.banner }]}>
      <Text style={[styles.text, { color: theme.onBanner }]}>{t('common.webDemoBanner')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { paddingVertical: 8, paddingHorizontal: 16 },
  text: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
});
