import { useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { Card } from '../../components/Card';
import { isLanguage } from '../../i18n';
import { RADIUS, useTheme } from '../../theme';
import { telUri } from '../help/helplines';
import { inLanguage, placeStatus, type SupportPlace } from './places';

type Props = { place: SupportPlace; today: Date };

/** One place: what it is, where, when, how to reach it, and how fresh the details are. */
export function PlaceDetail({ place, today }: Props) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = isLanguage(i18n.language) ? i18n.language : 'en';
  const name = inLanguage(place.name, language);
  const hours = inLanguage(place.hours, language);
  const [openFailed, setOpenFailed] = useState(false);
  // Only ever opened on a tap; a phone with no dialler or browser gets a note.
  const open = (url: string) => Linking.openURL(url).catch(() => setOpenFailed(true));

  return (
    <Card testID={`place-${place.id}`}>
      <View style={styles.titleRow}>
        <Text accessibilityRole="header" style={[styles.name, { color: theme.text }]}>
          {name}
        </Text>
        {place.demo ? (
          <Text style={[styles.badge, { backgroundColor: theme.banner, color: theme.onBanner }]}>
            {t('finder.demoBadge')}
          </Text>
        ) : null}
      </View>
      <Text style={[styles.type, { color: theme.primary }]}>{t(`finder.types.${place.type}`)}</Text>
      <Text style={[styles.detail, { color: theme.text }]}>
        {t('finder.area', { area: inLanguage(place.area, language) })}
      </Text>
      {hours ? (
        <Text style={[styles.detail, { color: theme.text }]}>
          {t('finder.hours', { hours })}
        </Text>
      ) : null}
      {place.demo ? (
        <Text style={[styles.note, { color: theme.textMuted }]}>{t('finder.demoNote')}</Text>
      ) : null}
      {place.phone ? (
        <>
          <Text style={[styles.phone, { color: theme.text }]}>{place.phone}</Text>
          <ActionButton
            testID={`place-${place.id}-call`}
            label={t('help.call', { name })}
            hint={t('help.callHint')}
            onPress={() => open(telUri(place.phone ?? ''))}
          />
        </>
      ) : null}
      {place.website ? (
        <ActionButton
          testID={`place-${place.id}-website`}
          tone="plain"
          label={t('finder.website')}
          hint={t('finder.websiteHint')}
          onPress={() => open(place.website ?? '')}
        />
      ) : null}
      {openFailed ? (
        <Text accessibilityLiveRegion="polite" style={[styles.note, { color: theme.text }]}>
          {t('finder.openFailed')}
        </Text>
      ) : null}
      <CheckedNote
        date={place.last_verified}
        status={placeStatus(place, today)}
        demo={place.demo}
      />
    </Card>
  );
}

function CheckedNote({
  date,
  status,
  demo,
}: {
  date: string | null;
  status: ReturnType<typeof placeStatus>;
  demo: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  // A made-up place is never presented as checked; the demo note says why.
  if (status === 'verified' && demo) return null;
  if (status === 'verified') {
    return (
      <Text style={[styles.note, { color: theme.textMuted }]}>
        {t('help.lastVerified', { date })}
      </Text>
    );
  }
  return (
    <Text style={[styles.note, styles.warning, { color: theme.text, borderColor: theme.help }]}>
      {status === 'stale' ? t('finder.stale', { date }) : t('finder.unverified')}
    </Text>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  name: { flexShrink: 1, fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  badge: {
    fontSize: 13,
    fontWeight: '700',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: RADIUS.pill,
    overflow: 'hidden',
  },
  type: { fontSize: 15, fontWeight: '700' },
  detail: { fontSize: 17, lineHeight: 25 },
  phone: { fontSize: 22, fontWeight: '700' },
  note: { fontSize: 15, lineHeight: 22 },
  warning: { borderLeftWidth: 4, paddingLeft: 10 },
});
