import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import type { Database } from '../../storage/types';
import { listCheckIns, localDay } from '../checkin/checkinRepo';
import { useSession } from '../session/SessionProvider';
import { computeProgress, type Progress } from '../slip/progress';
import { slipDays } from '../slip/slipRepo';
import { listSessions } from '../sos/sosRepo';
import { computeStats, type SosStats } from '../sos/stats';

export type Journey = Progress & {
  today: string;
  slipDays: string[];
  checkIns: number;
  sos: SosStats;
};

/** Where counting starts on first use: the earliest thing the user saved, or today. */
async function firstDay(db: Database, today: string): Promise<string> {
  // Made-up demo rows (development builds) never set the real start day.
  const [checkIns, firstSession] = await Promise.all([
    listCheckIns(db),
    db.getFirst<{ first: number | null }>(
      'SELECT MIN(started_at) AS first FROM sos_sessions WHERE demo = 0',
    ),
  ]);
  const days = checkIns.filter((c) => !c.demo).map((c) => c.day);
  if (firstSession?.first) days.push(localDay(firstSession.first));
  return days.reduce((earliest, day) => (day < earliest ? day : earliest), today);
}

/** Loads everything the progress views need; reloads whenever the screen is shown. */
export async function loadJourney(db: Database, start: string, now = Date.now()) {
  const today = localDay(now);
  const [days, checkIns, sessions] = await Promise.all([
    slipDays(db),
    listCheckIns(db),
    listSessions(db),
  ]);
  return {
    ...computeProgress({ start, today, slipDays: days }),
    today,
    slipDays: days,
    checkIns: checkIns.length,
    sos: computeStats(sessions),
  };
}

export function useJourney() {
  const { db, settings, updateSettings } = useSession();
  const [journey, setJourney] = useState<Journey | null>(null);

  const reload = useCallback(async () => {
    if (!db) return null;
    let start = settings.journeyStart;
    if (!start) {
      start = await firstDay(db, localDay());
      await updateSettings({ journeyStart: start });
    }
    const loaded = await loadJourney(db, start);
    setJourney(loaded);
    return loaded;
  }, [db, settings.journeyStart, updateSettings]);

  useFocusEffect(
    useCallback(() => {
      reload();
    }, [reload]),
  );

  return { journey, reload };
}
