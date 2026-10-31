import type { CircleRole } from '../../net/circleClient';
import type { Database } from '../../storage/types';

/** "Sister", "Ravi"... chosen by the user, kept encrypted here, never sent anywhere. */
export const MAX_LABEL_LENGTH = 40;

export async function getLabels(db: Database, role: CircleRole): Promise<Map<string, string>> {
  const rows = await db.getAll<{ link_id: string; label: string }>(
    'SELECT link_id, label FROM circle_labels WHERE role = ?',
    [role],
  );
  return new Map(rows.map((row) => [row.link_id, row.label]));
}

export async function saveLabel(
  db: Database,
  role: CircleRole,
  linkId: string,
  label: string,
): Promise<void> {
  await db.run(
    `INSERT INTO circle_labels (link_id, role, label) VALUES (?, ?, ?)
     ON CONFLICT(link_id) DO UPDATE SET label = excluded.label`,
    [linkId, role, label.trim().slice(0, MAX_LABEL_LENGTH)],
  );
}

export async function removeLabel(db: Database, linkId: string): Promise<void> {
  await db.run('DELETE FROM circle_labels WHERE link_id = ?', [linkId]);
}

/** Forgets labels of links the other person (or the server) has ended. */
export async function keepOnlyLabels(
  db: Database,
  role: CircleRole,
  linkIds: string[],
): Promise<void> {
  const labels = await getLabels(db, role);
  for (const linkId of labels.keys()) {
    if (!linkIds.includes(linkId)) await removeLabel(db, linkId);
  }
}

export async function removeAllLabels(db: Database, role: CircleRole): Promise<void> {
  await db.run('DELETE FROM circle_labels WHERE role = ?', [role]);
}
