/**
 * The only code that talks to the AI coach service. It sends the current
 * message, the language and at most the last few turns of this chat, and only
 * after the user has turned the coach on. Nothing else: no nickname, no
 * check-ins, no IDs. The service keeps nothing (docs/privacy.md).
 */
import type { Language } from '../i18n';
import { checkedBaseUrl } from './baseUrl';

export const MAX_HISTORY = 6;
export const MAX_TEXT = 500;

export type CoachTurn = { role: 'user' | 'coach'; text: string };
export type CoachKind = 'reply' | 'crisis' | 'refusal' | 'fallback';
export type CoachTopic = 'dosing' | 'withdrawal' | 'medical' | 'drug_use' | 'rules';
/** Only a `reply` carries model text; the app shows its own text for every other kind. */
export type CoachReply = {
  kind: CoachKind;
  topic: CoachTopic | null;
  text: string | null;
  reachOut: boolean;
};

export type CoachErrorKind = 'offline' | 'busy' | 'unavailable' | 'server';

export class CoachError extends Error {
  constructor(readonly kind: CoachErrorKind) {
    super(kind);
    this.name = 'CoachError';
  }
}

export type CoachClient = {
  send(input: { lang: Language; message: string; history: CoachTurn[] }): Promise<CoachReply>;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const KINDS: CoachKind[] = ['reply', 'crisis', 'refusal', 'fallback'];
const TOPICS: CoachTopic[] = ['dosing', 'withdrawal', 'medical', 'drug_use', 'rules'];
const STATUS_KINDS: Record<number, CoachErrorKind> = { 429: 'busy', 503: 'unavailable' };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

function parseReply(data: unknown): CoachReply {
  if (!isRecord(data) || !KINDS.includes(data.kind as CoachKind)) throw new CoachError('server');
  const kind = data.kind as CoachKind;
  const topic = data.topic ?? null;
  const text = data.text ?? null;
  const validTopic = topic === null || TOPICS.includes(topic as CoachTopic);
  const validText = kind === 'reply' ? typeof text === 'string' && text.length > 0 : text === null;
  if (!validTopic || !validText || (kind === 'refusal') !== (topic !== null)) {
    throw new CoachError('server');
  }
  return {
    kind,
    topic: topic as CoachTopic | null,
    text: text as string | null,
    reachOut: data.note === 'reach_out',
  };
}

export function createCoachClient({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 90_000,
}: {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): CoachClient {
  const url = `${baseUrl.replace(/\/+$/, '')}/coach`;

  return {
    async send({ lang, message, history }) {
      const turns = history
        .slice(-MAX_HISTORY)
        .map((turn) => ({ role: turn.role, text: turn.text.slice(0, MAX_TEXT) }));
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeoutMs);
      let response: Response;
      try {
        response = await fetchImpl(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lang, message: message.slice(0, MAX_TEXT), history: turns }),
          signal: controller.signal,
        });
      } catch {
        throw new CoachError('offline');
      } finally {
        clearTimeout(timer);
      }
      if (!response.ok) throw new CoachError(STATUS_KINDS[response.status] ?? 'server');
      return parseReply(await response.json().catch(() => null));
    },
  };
}

/** The coach service address from `app/.env` (EXPO_PUBLIC_COACH_API_URL); null when unset. */
export function coachBaseUrl(
  url = process.env.EXPO_PUBLIC_COACH_API_URL,
  dev: boolean = __DEV__,
): string | null {
  return checkedBaseUrl(url, dev);
}
