import type { TFunction } from 'i18next';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BodyText } from '../../components/BodyText';
import type { CircleErrorKind } from '../../net/circleClient';
import { useTheme } from '../../theme';

const ERROR_KEYS: Record<CircleErrorKind, string> = {
  offline: 'circle.errors.offline',
  notFound: 'circle.errors.notFound',
  full: 'circle.errors.full',
  alreadyLinked: 'circle.errors.alreadyLinked',
  noSupporters: 'circle.errors.noSupporters',
  dailyLimit: 'circle.errors.dailyLimit',
  tooManyTries: 'circle.errors.tooManyTries',
  invalid: 'circle.errors.invalid',
  unauthorized: 'circle.errors.generic',
  server: 'circle.errors.generic',
};

/** A calm, announced message for a failed circle action. */
export function CircleErrorText({ kind }: { kind: CircleErrorKind | null }) {
  const { t } = useTranslation();
  const theme = useTheme();
  if (!kind) return null;
  return (
    <Text
      testID="circle-error"
      accessibilityLiveRegion="polite"
      style={[styles.body, { color: theme.text }]}
    >
      {t(ERROR_KEYS[kind])}
    </Text>
  );
}

export function SectionHeading({ children }: { children: string }) {
  const theme = useTheme();
  return (
    <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
      {children}
    </Text>
  );
}

/** What leaves the phone and what never does, shown before the circle is turned on. */
export function SharingSummary() {
  const { t } = useTranslation();
  return (
    <>
      <SectionHeading>{t('circle.whatIsSent')}</SectionHeading>
      <BodyText>{t('circle.sentList')}</BodyText>
      <BodyText>{t('circle.notSentList')}</BodyText>
    </>
  );
}

const DAY = 24 * 60 * 60 * 1000;
const startOfDay = (time: number) => new Date(time).setHours(0, 0, 0, 0);

/** "today at 14:05", "yesterday at 09:30", "3 days ago". */
export function formatWhen(at: number, t: TFunction, now = Date.now()): string {
  const date = new Date(at);
  const pad = (n: number) => String(n).padStart(2, '0');
  const time = `${pad(date.getHours())}:${pad(date.getMinutes())}`;
  const days = Math.round((startOfDay(now) - startOfDay(at)) / DAY);
  if (days <= 0) return t('when.today', { time });
  if (days === 1) return t('when.yesterday', { time });
  return t('when.daysAgo', { count: days });
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  body: { fontSize: 17, lineHeight: 26 },
});
