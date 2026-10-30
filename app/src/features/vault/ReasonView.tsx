import { useEffect, useState } from 'react';
import { Image, StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { playVoice, stopVoice } from '../../platform/voice';
import type { Database } from '../../storage/types';
import { useTheme } from '../../theme';
import { dataUri } from '../../utils/base64';
import { getMedia, type VaultItem } from './vaultRepo';

/** Shows one saved reason: words, a photo, or a play button for a voice note. */
export function ReasonView({ item, db }: { item: VaultItem; db: Database }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [photo, setPhoto] = useState<string | null>(null);

  // Never keep playing once the reason is off screen.
  useEffect(() => stopVoice, []);

  useEffect(() => {
    if (item.kind !== 'photo') return;
    let mounted = true;
    getMedia(db, item.id).then((media) => {
      if (mounted && media) setPhoto(dataUri(media.bytes, media.mime));
    });
    return () => {
      mounted = false;
    };
  }, [db, item]);

  if (item.kind === 'text') {
    return <Text style={[styles.quote, { color: theme.text }]}>{item.text}</Text>;
  }

  if (item.kind === 'photo') {
    return photo ? (
      <Image
        testID={`vault-photo-${item.id}`}
        source={{ uri: photo }}
        accessibilityLabel={t('sos.photoReason')}
        style={styles.photo}
        resizeMode="cover"
      />
    ) : null;
  }

  return (
    <ActionButton
      testID={`vault-play-${item.id}`}
      tone="soft"
      label={t('sos.playVoice')}
      onPress={async () => {
        const media = await getMedia(db, item.id);
        if (media) await playVoice(media.bytes, media.mime);
      }}
    />
  );
}

const styles = StyleSheet.create({
  quote: { fontSize: 22, lineHeight: 32, fontWeight: '600', fontStyle: 'italic' },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 20 },
});
