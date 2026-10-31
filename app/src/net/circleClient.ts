/**
 * The only code that talks to the support-circle server. It sends random IDs,
 * a bearer token, invite codes and content-free "please check in" signals.
 * Never add check-ins, names, labels or anything personal here (docs/privacy.md).
 */
import type { Language } from '../i18n';

export type CircleRole = 'member' | 'supporter';
export type Credentials = { accountId: string; token: string; role: CircleRole };
export type LinkStatus = 'pending' | 'active';
export type LinkInfo = { id: string; status: LinkStatus; createdAt: number };
export type SignalInfo = { linkId: string; createdAt: number };
export type Invite = { code: string; expiresAt: number };

export type CircleErrorKind =
  | 'offline'
  | 'unauthorized'
  | 'notFound'
  | 'full'
  | 'alreadyLinked'
  | 'noSupporters'
  | 'dailyLimit'
  | 'tooManyTries'
  | 'invalid'
  | 'server';

export class CircleError extends Error {
  constructor(readonly kind: CircleErrorKind) {
    super(kind);
    this.name = 'CircleError';
  }
}

export type CircleClient = {
  createAccount(role: CircleRole): Promise<Credentials>;
  /** Already-deleted accounts count as done, so a queued retry is safe. */
  deleteAccount(token: string): Promise<void>;
  createInvite(token: string): Promise<Invite>;
  redeemInvite(token: string, typedCode: string): Promise<{ linkId: string }>;
  listLinks(token: string): Promise<LinkInfo[]>;
  approveLink(token: string, linkId: string): Promise<void>;
  revokeLink(token: string, linkId: string): Promise<void>;
  sendSignal(token: string): Promise<{ remainingToday: number }>;
  listSignals(token: string): Promise<SignalInfo[]>;
  setPushToken(token: string, pushToken: string, lang: Language): Promise<void>;
  removePushToken(token: string): Promise<void>;
};

type FetchLike = (url: string, init?: RequestInit) => Promise<Response>;

const DETAIL_KINDS: Record<string, CircleErrorKind> = {
  not_found: 'notFound',
  circle_full: 'full',
  already_linked: 'alreadyLinked',
  no_supporters: 'noSupporters',
  daily_limit: 'dailyLimit',
  too_many_tries: 'tooManyTries',
  unauthorized: 'unauthorized',
};

const STATUS_KINDS: Record<number, CircleErrorKind> = {
  401: 'unauthorized',
  404: 'notFound',
  422: 'invalid',
  429: 'tooManyTries',
};

export function cleanInviteCode(typed: string): string {
  return typed.replace(/[\s-]/g, '').toUpperCase();
}

export function formatInviteCode(code: string): string {
  return `${code.slice(0, 5)}-${code.slice(5)}`;
}

const isString = (v: unknown): v is string => typeof v === 'string';
const isNumber = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStatus = (v: unknown): v is LinkStatus => v === 'pending' || v === 'active';
const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;

const bad = (): never => {
  throw new CircleError('server');
};

const seconds = (s: number) => s * 1000;

function parseLink(v: unknown): LinkInfo {
  return isRecord(v) && isString(v.id) && isStatus(v.status) && isNumber(v.created_at)
    ? { id: v.id, status: v.status, createdAt: seconds(v.created_at) }
    : bad();
}

function parseSignal(v: unknown): SignalInfo {
  return isRecord(v) && isString(v.link_id) && isNumber(v.created_at)
    ? { linkId: v.link_id, createdAt: seconds(v.created_at) }
    : bad();
}

const parseList = <T>(data: unknown, parse: (v: unknown) => T): T[] =>
  Array.isArray(data) ? data.map(parse) : bad();

export function createCircleClient({
  baseUrl,
  fetchImpl = fetch,
  timeoutMs = 10_000,
}: {
  baseUrl: string;
  fetchImpl?: FetchLike;
  timeoutMs?: number;
}): CircleClient {
  const root = baseUrl.replace(/\/+$/, '');

  async function call(
    method: string,
    path: string,
    { token, body }: { token?: string; body?: unknown } = {},
  ): Promise<unknown> {
    const headers: Record<string, string> = {};
    if (token) headers.Authorization = `Bearer ${token}`;
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    let response: Response;
    try {
      response = await fetchImpl(`${root}${path}`, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch {
      throw new CircleError('offline');
    } finally {
      clearTimeout(timer);
    }
    const data: unknown = response.status === 204 ? null : await response.json().catch(() => null);
    if (!response.ok) {
      const detail = isRecord(data) && isString(data.detail) ? data.detail : '';
      throw new CircleError(DETAIL_KINDS[detail] ?? STATUS_KINDS[response.status] ?? 'server');
    }
    return data;
  }

  return {
    async createAccount(role) {
      const data = await call('POST', '/accounts', { body: { role } });
      return isRecord(data) && isString(data.account_id) && isString(data.token)
        ? { accountId: data.account_id, token: data.token, role }
        : bad();
    },
    async deleteAccount(token) {
      try {
        await call('DELETE', '/account', { token });
      } catch (error) {
        if (!(error instanceof CircleError && error.kind === 'unauthorized')) throw error;
      }
    },
    async createInvite(token) {
      const data = await call('POST', '/invites', { token });
      return isRecord(data) && isString(data.code) && isNumber(data.expires_at)
        ? { code: data.code, expiresAt: seconds(data.expires_at) }
        : bad();
    },
    async redeemInvite(token, typedCode) {
      const data = await call('POST', '/invites/redeem', {
        token,
        body: { code: cleanInviteCode(typedCode) },
      });
      return isRecord(data) && isString(data.link_id) ? { linkId: data.link_id } : bad();
    },
    async listLinks(token) {
      return parseList(await call('GET', '/links', { token }), parseLink);
    },
    async approveLink(token, linkId) {
      await call('POST', `/links/${encodeURIComponent(linkId)}/approve`, { token });
    },
    async revokeLink(token, linkId) {
      await call('DELETE', `/links/${encodeURIComponent(linkId)}`, { token });
    },
    async sendSignal(token) {
      const data = await call('POST', '/signals', { token });
      return isRecord(data) && isNumber(data.remaining_today)
        ? { remainingToday: data.remaining_today }
        : bad();
    },
    async listSignals(token) {
      return parseList(await call('GET', '/signals', { token }), parseSignal);
    },
    async setPushToken(token, pushToken, lang) {
      await call('PUT', '/account/push-token', { token, body: { token: pushToken, lang } });
    },
    async removePushToken(token) {
      await call('DELETE', '/account/push-token', { token });
    },
  };
}

/** Short code both phones show for a link, so the member can tell the right person joined. */
export function checkCode(linkId: string): string {
  return linkId.replace(/-/g, '').slice(-4).toUpperCase();
}

/**
 * The server address from `app/.env` (EXPO_PUBLIC_CIRCLE_API_URL), e.g. the
 * laptop's address on the home Wi-Fi. Null when not set: the circle is then
 * shown as not available on this build. Plain http (where anyone on the same
 * Wi-Fi could read the token) is allowed only in development builds or for
 * this computer itself; anything else must use https.
 */
export function circleBaseUrl(
  url = process.env.EXPO_PUBLIC_CIRCLE_API_URL,
  dev: boolean = __DEV__,
): string | null {
  if (!url) return null;
  if (url.startsWith('https://')) return url;
  const local = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?(\/|$)/.test(url);
  return url.startsWith('http://') && (dev || local) ? url : null;
}
