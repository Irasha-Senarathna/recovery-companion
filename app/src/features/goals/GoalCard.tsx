import * as Haptics from 'expo-haptics';
import { useEffect, useState } from 'react';
import { Animated, Platform, StyleSheet, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { Card } from '../../components/Card';
import { ConfirmAction } from '../../components/ConfirmAction';
import { useReducedMotion } from '../../components/useReducedMotion';
import { RADIUS, useTheme } from '../../theme';
import { isWinMilestone, nextWinMilestone, type Goal } from './goalsRepo';

export const AREA_EMOJI = {
  sleep: '🌙',
  health: '🌿',
  work: '📘',
  family: '🏡',
  money: '🪙',
} as const;

type Props = {
  goal: Goal;
  onWin: () => Promise<number>;
  onUndo: () => Promise<void>;
  onDelete: () => Promise<void>;
};

/** A goal with its small wins, a bar to the next milestone, and a moment of celebration. */
export function GoalCard({ goal, onWin, onUndo, onDelete }: Props) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [celebrate, setCelebrate] = useState<number | null>(null);
  const next = nextWinMilestone(goal.wins);

  const win = async () => {
    const total = await onWin();
    if (isWinMilestone(total)) {
      setCelebrate(total);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    } else {
      Haptics.selectionAsync().catch(() => {});
    }
  };

  return (
    <Card testID={`goal-${goal.id}`}>
      <View style={styles.header}>
        <Text style={styles.emoji} importantForAccessibility="no">
          {AREA_EMOJI[goal.area]}
        </Text>
        <View style={styles.flex}>
          <Text style={[styles.area, { color: theme.textMuted }]}>
            {t(`goals.areas.${goal.area}`)}
          </Text>
          <Text style={[styles.title, { color: theme.text }]}>{goal.title}</Text>
        </View>
      </View>

      <Bar fraction={goal.wins / next} label={t('goals.winsOf', { count: goal.wins, next })} />
      <Text style={[styles.wins, { color: theme.text }]}>
        {t('goals.wins', { count: goal.wins })}
      </Text>

      {celebrate !== null ? <Celebration wins={celebrate} /> : null}

      {goal.winToday ? (
        <>
          <Text testID={`goal-${goal.id}-done`} style={[styles.done, { color: theme.primary }]}>
            {t('goals.doneToday')}
          </Text>
          <ActionButton
            testID={`goal-${goal.id}-undo`}
            tone="plain"
            label={t('goals.undo')}
            onPress={async () => {
              setCelebrate(null);
              await onUndo();
            }}
          />
        </>
      ) : (
        <ActionButton testID={`goal-${goal.id}-win`} label={t('goals.logWin')} onPress={win} />
      )}
      <ConfirmAction
        testID={`goal-${goal.id}-delete`}
        label={t('goals.remove')}
        question={t('goals.removeConfirm')}
        confirmLabel={t('goals.removeYes')}
        onConfirm={onDelete}
      />
    </Card>
  );
}

/** A thin bar that fills with a critically damped spring. */
function Bar({ fraction, label }: { fraction: number; label: string }) {
  const theme = useTheme();
  const reduced = useReducedMotion();
  const width = useState(() => new Animated.Value(0))[0];
  const clamped = Math.max(0, Math.min(1, fraction));

  useEffect(() => {
    if (reduced) return width.setValue(clamped);
    const spring = Animated.spring(width, {
      toValue: clamped,
      bounciness: 0,
      speed: 8,
      useNativeDriver: false,
    });
    spring.start();
    return () => spring.stop();
  }, [clamped, reduced, width]);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      style={[styles.track, { backgroundColor: theme.surfaceSoft }]}
    >
      <Animated.View
        style={[
          styles.fill,
          {
            backgroundColor: theme.primary,
            width: width.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] }),
          },
        ]}
      />
    </View>
  );
}

/**
 * A small moment for a milestone: it grows into place (a touch of bounce,
 * because the user's own tap set it off). Reduced motion: it just appears.
 */
function Celebration({ wins }: { wins: number }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const reduced = useReducedMotion();
  const scale = useState(() => new Animated.Value(reduced ? 1 : 0.85))[0];

  useEffect(() => {
    if (reduced) return;
    Animated.spring(scale, {
      toValue: 1,
      bounciness: 6,
      speed: 14,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  }, [reduced, scale]);

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      style={[styles.celebrate, { backgroundColor: theme.accent, transform: [{ scale }] }]}
    >
      <Text style={[styles.celebrateText, { color: theme.onAccent }]}>
        {t('goals.milestone', { count: wins })}
      </Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', gap: 14, alignItems: 'center' },
  emoji: { fontSize: 30 },
  flex: { flex: 1, gap: 2 },
  area: { fontSize: 13, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase' },
  title: { fontSize: 19, fontWeight: '700', letterSpacing: -0.3, lineHeight: 24 },
  track: { height: 10, borderRadius: RADIUS.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: RADIUS.pill },
  wins: { fontSize: 15, fontWeight: '600' },
  done: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  celebrate: { borderRadius: RADIUS.button, padding: 14 },
  celebrateText: { fontSize: 17, fontWeight: '700', textAlign: 'center', lineHeight: 24 },
});
