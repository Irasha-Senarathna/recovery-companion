import type { Database } from '../../storage/types';

export type SosOutcome = 'passed' | 'not_yet' | 'unsure';

export type SosSession = {
  id: number;
  startedAt: number;
  endedAt: number | null;
  exerciseId: string | null;
  outcome: SosOutcome | null;
};

type Row = {
  id: number;
  started_at: number;
  ended_at: number | null;
  exercise_id: string | null;
  outcome: SosOutcome | null;
};

const OUTCOMES: SosOutcome[] = ['passed', 'not_yet', 'unsure'];

/** Recorded as soon as SOS opens, so a session left halfway still counts. */
export async function startSession(db: Database, now = Date.now()): Promise<number> {
  const { lastInsertRowId } = await db.run('INSERT INTO sos_sessions (started_at) VALUES (?)', [
    now,
  ]);
  return lastInsertRowId;
}

export async function setSessionExercise(db: Database, id: number, exerciseId: string) {
  await db.run('UPDATE sos_sessions SET exercise_id = ? WHERE id = ?', [exerciseId, id]);
}

export async function finishSession(
  db: Database,
  id: number,
  outcome: SosOutcome,
  now = Date.now(),
): Promise<void> {
  if (!OUTCOMES.includes(outcome)) throw new Error('Unknown outcome');
  await db.run('UPDATE sos_sessions SET outcome = ?, ended_at = ? WHERE id = ?', [
    outcome,
    now,
    id,
  ]);
}

export async function listSessions(db: Database): Promise<SosSession[]> {
  const rows = await db.getAll<Row>(
    'SELECT id, started_at, ended_at, exercise_id, outcome FROM sos_sessions ORDER BY id DESC',
  );
  return rows.map((row) => ({
    id: row.id,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    exerciseId: row.exercise_id,
    outcome: row.outcome,
  }));
}
