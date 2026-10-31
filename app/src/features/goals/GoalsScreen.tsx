import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { AnimatedNumber } from '../../components/AnimatedNumber';
import { BodyText } from '../../components/BodyText';
import { Card } from '../../components/Card';
import { ChipGroup } from '../../components/ChipGroup';
import { EmptyState } from '../../components/EmptyState';
import { SafeTextInput } from '../../components/SafeTextInput';
import { ScreenLayout } from '../../components/ScreenLayout';
import type { Database } from '../../storage/types';
import { useTheme } from '../../theme';
import { useJourney } from '../progress/useJourney';
import { useSession } from '../session/SessionProvider';
import { GoalCard } from './GoalCard';
import {
  addGoal,
  AREAS,
  deleteGoal,
  listGoals,
  logWin,
  MAX_GOALS,
  MAX_TITLE_LENGTH,
  undoWin,
  type Area,
  type Goal,
} from './goalsRepo';
import { formatAmount, moneySaved, nextMoneyMilestone, parseAmount } from './moneySaved';

const IDEAS = ['one', 'two', 'three'] as const;
const EXAMPLE_AMOUNT = formatAmount(1500); // not-a-phone-number: an example sum of money

/** Rebuild: a few goals that matter, small wins, and the money kept. */
export function GoalsScreen() {
  const { t } = useTranslation();
  const { db } = useSession();
  return <ScreenLayout title={t('goals.title')}>{db ? <Goals db={db} /> : null}</ScreenLayout>;
}

function Goals({ db }: { db: Database }) {
  const { t } = useTranslation();
  const [goals, setGoals] = useState<Goal[]>([]);

  const load = useCallback(async () => setGoals(await listGoals(db)), [db]);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return (
    <>
      <BodyText>{t('goals.intro')}</BodyText>
      <MoneyCard />
      {goals.length === 0 ? <EmptyState testID="goals-empty" message={t('goals.empty')} /> : null}
      {goals.map((goal) => (
        <GoalCard
          key={goal.id}
          goal={goal}
          onWin={async () => {
            const total = await logWin(db, goal.id);
            await load();
            return total;
          }}
          onUndo={async () => {
            await undoWin(db, goal.id);
            await load();
          }}
          onDelete={async () => {
            await deleteGoal(db, goal.id);
            await load();
          }}
        />
      ))}
      {goals.length < MAX_GOALS ? (
        <AddGoal db={db} onAdded={load} hasGoals={goals.length > 0} />
      ) : (
        <BodyText>{t('goals.enough')}</BodyText>
      )}
    </>
  );
}

function AddGoal({
  db,
  onAdded,
  hasGoals,
}: {
  db: Database;
  onAdded: () => void;
  hasGoals: boolean;
}) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [area, setArea] = useState<Area | null>(null);
  const [title, setTitle] = useState('');
  const suggestions = area ? IDEAS.map((key) => t(`goals.ideas.${area}.${key}`)) : [];

  const add = async () => {
    if (!area || title.trim() === '') return;
    await addGoal(db, { area, title });
    setArea(null);
    setTitle('');
    onAdded();
  };

  return (
    <Card tone="soft">
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
        {hasGoals ? t('goals.addAnother') : t('goals.addFirst')}
      </Text>
      <ChipGroup
        testID="goal-area"
        label={t('goals.areaLabel')}
        options={AREAS.map((id) => ({ id, label: t(`goals.areas.${id}`) }))}
        selected={area ? [area] : []}
        onToggle={(id) => setArea(id as Area)}
      />
      {area ? (
        <>
          <Text style={[styles.note, { color: theme.textMuted }]}>{t('goals.ideasLabel')}</Text>
          <ChipGroup
            testID="goal-idea"
            label={t('goals.ideasLabel')}
            options={suggestions.map((idea, i) => ({ id: String(i), label: idea }))}
            selected={suggestions.includes(title) ? [String(suggestions.indexOf(title))] : []}
            onToggle={(id) => setTitle(suggestions[Number(id)])}
          />
          <SafeTextInput
            testID="goal-title"
            label={t('goals.titleLabel')}
            value={title}
            maxLength={MAX_TITLE_LENGTH}
            onChangeText={setTitle}
          />
          <ActionButton
            testID="goal-add"
            label={t('goals.add')}
            disabled={title.trim() === ''}
            onPress={add}
          />
        </>
      ) : null}
    </Card>
  );
}

/** The money kept so far: grows with strong days, which a slip never resets. */
function MoneyCard() {
  const { t } = useTranslation();
  const theme = useTheme();
  const { settings, updateSettings } = useSession();
  const { journey } = useJourney();
  const [editing, setEditing] = useState(false);
  const [typed, setTyped] = useState('');
  const perDay = settings.moneyPerDay;
  const saved = journey ? moneySaved(perDay, journey.strongDays) : null;

  if (perDay === null || editing) {
    const amount = parseAmount(typed);
    return (
      <Card tone="accent">
        <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
          {t('goals.moneyTitle')}
        </Text>
        <BodyText>{t('goals.moneyInfo')}</BodyText>
        <SafeTextInput
          testID="money-per-day"
          label={t('goals.moneyLabel')}
          hint={t('goals.moneyHint', { example: EXAMPLE_AMOUNT })}
          value={typed}
          keyboardType="number-pad"
          maxLength={9}
          onChangeText={setTyped}
          error={typed !== '' && amount === null ? t('goals.moneyInvalid') : null}
        />
        <ActionButton
          testID="money-save"
          label={t('goals.moneySave')}
          disabled={amount === null}
          onPress={async () => {
            await updateSettings({ moneyPerDay: amount });
            setEditing(false);
            setTyped('');
          }}
        />
        {perDay !== null ? (
          <ActionButton
            testID="money-remove"
            tone="plain"
            label={t('goals.moneyRemove')}
            onPress={async () => {
              await updateSettings({ moneyPerDay: null });
              setEditing(false);
            }}
          />
        ) : null}
      </Card>
    );
  }

  const next = nextMoneyMilestone(saved ?? 0);
  return (
    <Card tone="accent" testID="money-card">
      <Text style={[styles.note, { color: theme.onAccent }]}>{t('goals.moneyKept')}</Text>
      <AnimatedNumber
        testID="money-saved"
        value={saved ?? 0}
        format={(n) => t('goals.amount', { amount: formatAmount(n) })}
        style={[styles.money, { color: theme.onAccent }]}
      />
      <View style={styles.row}>
        <Text style={[styles.note, { color: theme.onAccent }]}>
          {t('goals.moneyNext', { amount: formatAmount(next) })}
        </Text>
      </View>
      <ActionButton
        testID="money-edit"
        tone="plain"
        label={t('goals.moneyChange')}
        onPress={() => {
          setTyped(String(perDay));
          setEditing(true);
        }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.3 },
  note: { fontSize: 15, lineHeight: 22, fontWeight: '600' },
  money: { fontSize: 40, fontWeight: '800', letterSpacing: -1.2 },
  row: { flexDirection: 'row' },
});
