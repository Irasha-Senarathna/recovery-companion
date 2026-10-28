import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { isLanguage } from '../../i18n';
import { useTheme } from '../../theme';
import {
  displayName,
  isTrustedEmergency,
  telUri,
  verificationStatus,
  type HelplineEntry,
} from './helplines';

type Props = { entries: HelplineEntry[]; today?: Date };

export function HelplineList({ entries, today = new Date() }: Props) {
  const { t } = useTranslation();
  if (entries.length === 0) return <BodyText>{t('help.notSetUp')}</BodyText>;
  return (
    <>
      {entries.map((entry) => (
        <HelplineCard key={entry.id} entry={entry} today={today} />
      ))}
    </>
  );
}

function HelplineCard({ entry, today }: { entry: HelplineEntry; today: Date }) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = isLanguage(i18n.language) ? i18n.language : 'en';
  const emergency = isTrustedEmergency(entry, today);
  // An unnamed or unchecked "emergency" entry is shown as a plain contact.
  const fallbackType = entry.type === 'emergency' && !emergency ? 'other' : entry.type;
  const name = displayName(entry, language) ?? t(`help.types.${fallbackType}`);
  const status = verificationStatus(entry.last_verified, today);
  const date = entry.last_verified ?? '';

  return (
    <View style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.border }]}>
      <Text accessibilityRole="header" style={[styles.name, { color: theme.text }]}>
        {name}
      </Text>
      <Text style={[styles.phone, { color: theme.text }]}>{entry.phone}</Text>
      {entry.hours ? <BodyText>{t('help.hours', { hours: entry.hours })}</BodyText> : null}
      <ActionButton
        tone={emergency ? 'danger' : 'primary'}
        label={t('help.call', { name })}
        hint={t('help.callHint')}
        onPress={() => Linking.openURL(telUri(entry.phone))}
      />
      {status === 'verified' ? (
        <Text style={[styles.note, { color: theme.textMuted }]}>
          {t('help.lastVerified', { date })}
        </Text>
      ) : (
        <Text style={[styles.note, { color: theme.help }]}>
          {status === 'stale' ? t('help.stale', { date }) : t('help.unverified')}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 2, borderRadius: 12, padding: 16, gap: 8 },
  name: { fontSize: 19, fontWeight: '700' },
  phone: { fontSize: 22, fontWeight: '700' },
  note: { fontSize: 15, lineHeight: 22 },
});
