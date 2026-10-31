import type { CoachErrorKind, CoachReply, CoachTurn } from '../../net/coachClient';
import { detectCrisis } from '../../safety/crisisDetector';

/** One line of the chat. Held in the screen's memory only, never stored. */
export type Entry =
  | { id: number; from: 'user'; text: string; sent: boolean }
  | { id: number; from: 'coach'; reply: CoachReply }
  | { id: number; from: 'error'; kind: CoachErrorKind };

type WithoutId<T> = T extends unknown ? Omit<T, 'id'> : never;
export type NewEntry = WithoutId<Entry>;

export type SendPlan = { action: 'none' | 'crisis' | 'send'; message: string };

/** Safety rule 4: a message with crisis words never leaves the phone. */
export function planSend(draft: string): SendPlan {
  const message = draft.trim();
  if (!message) return { action: 'none', message };
  return { action: detectCrisis(message) ? 'crisis' : 'send', message };
}

/** Earlier turns the coach may see: sent messages and its own replies only. */
export function historyOf(entries: Entry[]): CoachTurn[] {
  return entries.flatMap((entry): CoachTurn[] => {
    if (entry.from === 'user' && entry.sent) return [{ role: 'user', text: entry.text }];
    if (entry.from === 'coach' && entry.reply.kind === 'reply' && entry.reply.text) {
      return [{ role: 'coach', text: entry.reply.text }];
    }
    return [];
  });
}
