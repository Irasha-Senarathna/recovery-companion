import { useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { EmptyState } from '../../components/EmptyState';
import { ChipGroup } from '../../components/ChipGroup';
import { ScreenLayout } from '../../components/ScreenLayout';
import { isLanguage } from '../../i18n';
import { useTheme } from '../../theme';
import { PlaceDetail } from './PlaceDetail';
import {
  filterPlaces,
  inLanguage,
  listAreas,
  loadPlaces,
  PLACE_TYPES,
  type PlaceType,
  type SupportPlace,
} from './places';

const ALL = 'all';

type Props = { places?: SupportPlace[]; today?: Date };

/** Treatment and support places, read only from the bundled content file. */
export function FinderScreen({ places = loadPlaces(), today = new Date() }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const router = useRouter();
  const [type, setType] = useState<PlaceType | null>(null);
  const [area, setArea] = useState<string | null>(null);
  const shown = useMemo(() => filterPlaces(places, { type, area }), [places, type, area]);

  return (
    <ScreenLayout title={t('finder.title')} testID="finder-screen">
      <BodyText>{t('finder.intro')}</BodyText>
      {places.some((p) => p.demo) ? (
        <Text style={[styles.banner, { backgroundColor: theme.banner, color: theme.onBanner }]}>
          {t('finder.demoIntro')}
        </Text>
      ) : null}
      <ActionButton
        testID="open-first-visit"
        tone="soft"
        label={t('finder.firstVisit')}
        onPress={() => router.push('/first-visit')}
      />
      {places.length === 0 ? (
        <EmptyState testID="finder-empty" message={t('finder.none')} />
      ) : (
        <>
          <Filters places={places} type={type} area={area} onType={setType} onArea={setArea} />
          {shown.length === 0 ? (
            <EmptyState
              testID="finder-no-match"
              message={t('finder.noMatch')}
              action={{
                testID: 'finder-clear',
                label: t('finder.clear'),
                onPress: () => {
                  setType(null);
                  setArea(null);
                },
              }}
            />
          ) : (
            shown.map((place) => <PlaceDetail key={place.id} place={place} today={today} />)
          )}
        </>
      )}
      <ActionButton
        testID="finder-back"
        tone="plain"
        label={t('common.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      />
    </ScreenLayout>
  );
}

type FilterProps = {
  places: SupportPlace[];
  type: PlaceType | null;
  area: string | null;
  onType: (type: PlaceType | null) => void;
  onArea: (area: string | null) => void;
};

function Filters({ places, type, area, onType, onArea }: FilterProps) {
  const { t, i18n } = useTranslation();
  const theme = useTheme();
  const language = isLanguage(i18n.language) ? i18n.language : 'en';
  const areaLabel = (key: string) => {
    const match = places.find((p) => p.area.en === key);
    return match ? inLanguage(match.area, language) : key;
  };

  return (
    <View style={styles.filters}>
      <Text style={[styles.label, { color: theme.textMuted }]}>{t('finder.typeLabel')}</Text>
      <ChipGroup
        testID="finder-type"
        label={t('finder.typeLabel')}
        options={[
          { id: ALL, label: t('finder.allTypes') },
          ...PLACE_TYPES.map((id) => ({ id, label: t(`finder.types.${id}`) })),
        ]}
        selected={[type ?? ALL]}
        onToggle={(id) => onType(id === ALL ? null : (id as PlaceType))}
      />
      <Text style={[styles.label, { color: theme.textMuted }]}>{t('finder.areaLabel')}</Text>
      <ChipGroup
        testID="finder-area"
        label={t('finder.areaLabel')}
        options={[
          { id: ALL, label: t('finder.allAreas') },
          ...listAreas(places).map((id) => ({ id, label: areaLabel(id) })),
        ]}
        selected={[area ?? ALL]}
        onToggle={(id) => onArea(id === ALL ? null : id)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { fontSize: 15, lineHeight: 22, fontWeight: '600', padding: 12, borderRadius: 12 },
  filters: { gap: 10 },
  label: { fontSize: 15, fontWeight: '700' },
});
