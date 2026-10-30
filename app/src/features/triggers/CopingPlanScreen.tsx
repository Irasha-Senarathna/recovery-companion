import { useEffect, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ActionButton } from '../../components/ActionButton';
import { BodyText } from '../../components/BodyText';
import { SafeTextInput } from '../../components/SafeTextInput';
import { ScreenLayout } from '../../components/ScreenLayout';
import type { Database } from '../../storage/types';
import { useTheme } from '../../theme';
import { useSession } from '../session/SessionProvider';
import { SupportActions } from '../sos/SosSteps';
import {
  EMPTY_PLAN,
  getCopingPlan,
  MAX_PLAN_LENGTH,
  saveCopingPlan,
  type CopingPlan,
} from './copingPlanRepo';

const FIELDS: (keyof CopingPlan)[] = ['signs', 'helps', 'people'];

/** "My plan": early signs, what helps and who to contact, kept on this phone. */
export function CopingPlanScreen() {
  const { t } = useTranslation();
  const { db } = useSession();
  return <ScreenLayout title={t('plan.title')}>{db ? <PlanForm db={db} /> : null}</ScreenLayout>;
}

function PlanForm({ db }: { db: Database }) {
  const { t } = useTranslation();
  const theme = useTheme();
  const [plan, setPlan] = useState<CopingPlan>(EMPTY_PLAN);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;
    getCopingPlan(db).then((stored) => mounted && setPlan(stored));
    return () => {
      mounted = false;
    };
  }, [db]);

  const save = async () => {
    try {
      await saveCopingPlan(db, plan);
      setError(false);
      setSaved(true);
    } catch {
      setError(true);
    }
  };

  return (
    <>
      <BodyText>{t('plan.intro')}</BodyText>
      <BodyText>{t('plan.urgentNote')}</BodyText>
      {FIELDS.map((field) => (
        <SafeTextInput
          key={field}
          testID={`plan-${field}`}
          label={t(`plan.${field}`)}
          hint={t(`plan.${field}Hint`)}
          value={plan[field]}
          multiline
          maxLength={MAX_PLAN_LENGTH}
          onChangeText={(text) => {
            setSaved(false);
            setPlan((current) => ({ ...current, [field]: text }));
          }}
        />
      ))}
      <ActionButton testID="plan-save" label={t('plan.save')} onPress={save} />
      {error ? <BodyText>{t('plan.saveError')}</BodyText> : null}
      {saved ? (
        <Text testID="plan-saved" style={[styles.saved, { color: theme.text }]}>
          {t('plan.saved')}
        </Text>
      ) : null}
      <Text accessibilityRole="header" style={[styles.heading, { color: theme.text }]}>
        {t('plan.reachOut')}
      </Text>
      <SupportActions />
    </>
  );
}

const styles = StyleSheet.create({
  heading: { fontSize: 20, fontWeight: '700', letterSpacing: -0.2 },
  saved: { fontSize: 17, fontWeight: '600', textAlign: 'center' },
});
