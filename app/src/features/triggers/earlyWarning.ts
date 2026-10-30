import type { TFunction } from 'i18next';
import { explain, type Reason } from '../../ml/explain';
import { buildFeatures } from '../../ml/featureBuilder';
import { peakHour, planNudge } from '../../ml/nudgeScheduler';
import { isHarderDay, MODEL, predictRisk } from '../../ml/predict';
import { cancelNudge, scheduleNudge } from '../../platform/notifications';
import type { AppSettings } from '../../storage/settings';
import type { Database } from '../../storage/types';
import { getCheckIn, listCheckIns, localDay } from '../checkin/checkinRepo';
import { listSessions } from '../sos/sosRepo';

export type Today = { score: number; harder: boolean; reasons: Reason[] };

/** Today's gentle risk estimate from the user's own check-ins; null before today's check-in. */
export async function assessToday(db: Database, now = Date.now()): Promise<Today | null> {
  const today = await getCheckIn(db, localDay(now));
  if (!today) return null;
  const previous = (await listCheckIns(db)).filter((c) => c.day < today.day);
  const features = buildFeatures(today, previous);
  const score = predictRisk(features);
  const harder = isHarderDay(score);
  return { score, harder, reasons: harder ? explain(features) : [] };
}

type Deps = {
  db: Database;
  settings: Pick<AppSettings, 'nudgesEnabled' | 'lastNudgeAt'>;
  updateSettings: (patch: Partial<AppSettings>) => Promise<void>;
  t: TFunction;
  now?: number;
};

/**
 * Brings today's heads-up in line with the latest check-in: schedules the one
 * nudge on a harder day, or cancels a pending one that no longer applies.
 */
export async function refreshNudge({
  db,
  settings,
  updateSettings,
  t,
  now = Date.now(),
}: Deps): Promise<void> {
  const pending = settings.lastNudgeAt !== null && settings.lastNudgeAt > now;
  const today = settings.nudgesEnabled ? await assessToday(db, now) : null;
  const at = today
    ? planNudge({
        score: today.score,
        threshold: MODEL.threshold,
        now,
        peak: peakHour(await listSessions(db)),
        // A pending nudge can be re-planned; one that already went out cannot.
        lastNudgeAt: pending ? null : settings.lastNudgeAt,
      })
    : null;

  if (at !== null) {
    await scheduleNudge({
      at,
      title: t('notifications.nudgeTitle'),
      body: t('notifications.nudgeBody'),
      channelName: t('notifications.nudgeChannelName'),
    });
    await updateSettings({ lastNudgeAt: at });
  } else if (pending || !settings.nudgesEnabled) {
    await cancelNudge();
    if (pending) await updateSettings({ lastNudgeAt: null });
  }
}
