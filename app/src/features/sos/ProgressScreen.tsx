import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Card } from '../../components/Card';
import { CalmScene } from '../../components/illustrations/CalmScene';
import { ScreenLayout } from '../../components/ScreenLayout';
import { useSession } from '../session/SessionProvider';
import { listSessions } from './sosRepo';
import { StatsText } from './SosSteps';
import { computeStats, type SosStats } from './stats';

/** "Cravings you got through: N. They usually pass in about M minutes." */
export function ProgressScreen() {
  const { t } = useTranslation();
  const { db } = useSession();
  const [stats, setStats] = useState<SosStats | null>(null);

  useEffect(() => {
    if (!db) return;
    let mounted = true;
    listSessions(db).then((sessions) => mounted && setStats(computeStats(sessions)));
    return () => {
      mounted = false;
    };
  }, [db]);

  return (
    <ScreenLayout title={t('progress.title')} hero={<CalmScene />}>
      {stats ? (
        <Card tone="accent">
          <StatsText stats={stats} />
        </Card>
      ) : null}
    </ScreenLayout>
  );
}
