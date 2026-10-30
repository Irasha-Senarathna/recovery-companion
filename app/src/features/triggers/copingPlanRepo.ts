import type { Database } from '../../storage/types';

export type CopingPlan = {
  /** "My early signs": what the user notices when things start getting harder. */
  signs: string;
  /** "What helps me". */
  helps: string;
  /** "Who I can contact". */
  people: string;
};

export const MAX_PLAN_LENGTH = 1000;
export const EMPTY_PLAN: CopingPlan = { signs: '', helps: '', people: '' };

export async function getCopingPlan(db: Database): Promise<CopingPlan> {
  const row = await db.getFirst<CopingPlan>(
    'SELECT signs, helps, people FROM coping_plan WHERE id = 1',
  );
  return row ?? EMPTY_PLAN;
}

export async function saveCopingPlan(
  db: Database,
  plan: CopingPlan,
  now = Date.now(),
): Promise<void> {
  const clean = (text: string) => text.trim().slice(0, MAX_PLAN_LENGTH);
  await db.run(
    `INSERT INTO coping_plan (id, signs, helps, people, updated_at) VALUES (1, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET signs = excluded.signs, helps = excluded.helps,
       people = excluded.people, updated_at = excluded.updated_at`,
    [clean(plan.signs), clean(plan.helps), clean(plan.people), now],
  );
}
