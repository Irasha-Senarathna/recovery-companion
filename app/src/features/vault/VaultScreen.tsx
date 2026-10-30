import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { ScreenLayout } from '../../components/ScreenLayout';
import type { Database } from '../../storage/types';
import { useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { AddReason } from './AddReason';
import { ReasonView } from './ReasonView';
import { deleteItem, listItems, type VaultItem } from './vaultRepo';

/** The reasons vault: words, photos and voice notes, all inside the encrypted DB. */
export function VaultScreen() {
  const { t } = useTranslation();
  const { db } = useSession();
  return <ScreenLayout title={t('vault.title')}>{db ? <Vault db={db} /> : null}</ScreenLayout>;
}

function Vault({ db }: { db: Database }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [items, setItems] = useState<VaultItem[]>([]);

  const refresh = useCallback(() => listItems(db).then(setItems), [db]);

  useEffect(() => {
    let mounted = true;
    listItems(db).then((list) => mounted && setItems(list));
    return () => {
      mounted = false;
    };
  }, [db]);

  return (
    <>
      <Text style={[styles.intro, { color: theme.textMuted }]}>{t('vault.intro')}</Text>
      <AddReason db={db} onAdded={refresh} />
      {items.length === 0 ? <BodyText>{t('vault.empty')}</BodyText> : null}
      {items.map((item) => (
        <VaultCard key={item.id} item={item} db={db} onDeleted={refresh} />
      ))}
    </>
  );
}

function VaultCard({
  item,
  db,
  onDeleted,
}: {
  item: VaultItem;
  db: Database;
  onDeleted: () => void;
}) {
  const { t } = useTranslation();
  const [confirming, setConfirming] = useState(false);

  return (
    <Card>
      <ReasonView item={item} db={db} />
      <View style={styles.row}>
        {confirming ? (
          <>
            <ActionButton
              testID={`vault-delete-confirm-${item.id}`}
              tone="danger"
              label={t('vault.deleteConfirm')}
              onPress={async () => {
                await deleteItem(db, item.id);
                onDeleted();
              }}
            />
            <ActionButton
              tone="plain"
              label={t('common.cancel')}
              onPress={() => setConfirming(false)}
            />
          </>
        ) : (
          <ActionButton
            testID={`vault-delete-${item.id}`}
            tone="plain"
            label={t('vault.delete')}
            onPress={() => setConfirming(true)}
          />
        )}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  intro: { fontSize: 17, lineHeight: 26 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
