import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { OptionButton } from '../../components/OptionButton';
import { ScreenLayout } from '../../components/ScreenLayout';
import { StepScale } from '../../components/StepScale';
import type { Database } from '../../storage/types';
import { useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { refreshNudge } from '../triggers/earlyWarning';
import { getCheckIn, localDay, saveCheckIn, type Levels } from './checkinRepo';
import { LEVELS, MEASURES, TAGS, type Tag } from './tags';

/** At or above this craving level, the saved screen offers SOS. */
const STRONG_CRAVING = 3;
/** At this mood level, the saved screen offers people to talk to. */
const VERY_LOW_MOOD = 0;
/** Low mood together with a strong craving also offers people, not only SOS. */
const LOW_MOOD = 1;
/** Higher is harder for these, so their scales use a quieter colour. */
const NEUTRAL: readonly string[] = ['stress', 'craving'];

/** Four quick answers and optional tags; one tap to save. */
export function CheckInScreen() {
  const { t } = useTranslation();
  const { db } = useSession();
  return (
    <ScreenLayout title={t('checkin.title')}>{db ? <CheckInForm db={db} /> : null}</ScreenLayout>
  );
}

function CheckInForm({ db }: { db: Database }) {
  const { t } = useTranslation();
  const { settings, updateSettings } = useSession();
  const theme = useTheme();
  const [levels, setLevels] = useState<Partial<Levels>>({});
  const [tags, setTags] = useState<Tag[]>([]);
  const [saved, setSaved] = useState<Levels | null>(null);
  const [error, setError] = useState(false);

  // Today's answers, if any, so they can be changed.
  useEffect(() => {
    let mounted = true;
    getCheckIn(db, localDay()).then((today) => {
      if (!mounted || !today) return;
      const { mood, sleep, stress, craving } = today;
      setLevels({ mood, sleep, stress, craving });
      setTags(today.tags);
    });
    return () => {
      mounted = false;
    };
  }, [db]);

  const complete = MEASURES.every((m) => levels[m] !== undefined);

  const toggleTag = (tag: Tag) =>
    setTags((current) =>
      current.includes(tag) ? current.filter((t) => t !== tag) : [...current, tag],
    );

  const save = async () => {
    if (!complete) return;
    try {
      await saveCheckIn(db, { ...(levels as Levels), tags });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
      // A missed heads-up must never block saving.
      refreshNudge({ db, settings, updateSettings, t }).catch(() => {});
      setSaved(levels as Levels);
    } catch {
      setError(true);
    }
  };

  if (saved) return <Saved levels={saved} />;

  return (
    <>
      <BodyText>{t('checkin.intro')}</BodyText>
      {MEASURES.map((measure) => (
        <Card key={measure}>
          <StepScale
            testID={`scale-${measure}`}
            label={t(`checkin.measures.${measure}.label`)}
            levels={LEVELS.map((level) => t(`checkin.measures.${measure}.levels.${level}`))}
            value={levels[measure] ?? null}
            onChange={(value) => setLevels((current) => ({ ...current, [measure]: value }))}
            placeholder={t('checkin.notSet')}
            hint={t('checkin.scaleHint')}
            neutral={NEUTRAL.includes(measure)}
          />
        </Card>
      ))}

      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
        {t('checkin.tagsTitle')}
      </Text>
      <BodyText>{t('checkin.tagsInfo')}</BodyText>
      <View style={styles.tags}>
        {TAGS.map((tag) => (
          <OptionButton
            key={tag}
            testID={`tag-${tag}`}
            label={t(`checkin.tags.${tag}`)}
            selected={tags.includes(tag)}
            onPress={() => toggleTag(tag)}
          />
        ))}
      </View>

      {error ? <BodyText>{t('checkin.saveError')}</BodyText> : null}
      <ActionButton
        testID="checkin-save"
        label={t('checkin.save')}
        hint={complete ? undefined : t('checkin.saveHint')}
        disabled={!complete}
        onPress={save}
      />
    </>
  );
}

function Saved({ levels }: { levels: Levels }) {
  const { t } = useTranslation();
  const router = useRouter();
  const theme = useTheme();
  const strongCraving = levels.craving >= STRONG_CRAVING;
  const offerHelp = levels.mood === VERY_LOW_MOOD || (levels.mood <= LOW_MOOD && strongCraving);

  return (
    <>
      <Card tone="accent">
        <Text
          testID="checkin-saved"
          accessibilityRole="header"
          style={[styles.savedTitle, { color: theme.onAccent }]}
        >
          {t('checkin.savedTitle')}
        </Text>
        <BodyText>{t('checkin.savedBody')}</BodyText>
      </Card>
      {offerHelp ? (
        <Card tone="soft">
          <BodyText>{t('checkin.lowMood')}</BodyText>
          <ActionButton
            testID="checkin-get-help"
            label={t('checkin.getHelp')}
            onPress={() => router.push('/help')}
          />
        </Card>
      ) : null}
      {strongCraving ? (
        <Card tone="soft">
          <BodyText>{t('checkin.strongCraving')}</BodyText>
          <ActionButton
            testID="checkin-open-sos"
            label={t('checkin.openSos')}
            onPress={() => router.replace('/sos')}
          />
        </Card>
      ) : null}
      <ActionButton
        testID="checkin-done"
        tone="plain"
        label={t('checkin.done')}
        onPress={() => router.replace('/')}
      />
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  savedTitle: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
});
