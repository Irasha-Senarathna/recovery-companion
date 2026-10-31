import { isUnencrypted } from '../baseUrl';
import { coachBaseUrl, CoachError, createCoachClient, MAX_HISTORY } from '../coachClient';

function fakeFetch(status: number, body: unknown = null) {
  const calls: { url: string; init: RequestInit }[] = [];
  const impl = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({ url, init });
    return { ok: status >= 200 && status < 300, status, json: async () => body } as Response;
  });
  return { impl, calls };
}

const sent = (calls: { init: RequestInit }[]) => JSON.parse(calls[0].init.body as string);

describe('coachClient', () => {
  it('sends only the language, the message and the last turns', async () => {
    const { impl, calls } = fakeFetch(200, { kind: 'reply', topic: null, text: 'Hi', note: null });
    const client = createCoachClient({ baseUrl: 'http://laptop:8001/', fetchImpl: impl });
    const history = Array.from({ length: 9 }, (_, i) => ({
      role: i % 2 ? ('coach' as const) : ('user' as const),
      text: `turn ${i}`,
    }));

    const reply = await client.send({ lang: 'si', message: 'hello', history });

    expect(reply).toEqual({ kind: 'reply', topic: null, text: 'Hi', reachOut: false });
    expect(calls[0].url).toBe('http://laptop:8001/coach');
    expect(calls[0].init.method).toBe('POST');
    expect(calls[0].init.headers).toEqual({ 'Content-Type': 'application/json' });
    const body = sent(calls);
    expect(Object.keys(body).sort()).toEqual(['history', 'lang', 'message']);
    expect(body.lang).toBe('si');
    expect(body.history).toHaveLength(MAX_HISTORY);
    expect(body.history[MAX_HISTORY - 1]).toEqual({ role: 'user', text: 'turn 8' });
  });

  it('shortens long earlier turns to what the service accepts', async () => {
    const { impl, calls } = fakeFetch(200, { kind: 'fallback', topic: null, text: null });
    const client = createCoachClient({ baseUrl: 'http://laptop:8001', fetchImpl: impl });
    await client.send({
      lang: 'en',
      message: 'hi',
      history: [{ role: 'coach', text: 'x'.repeat(900) }],
    });
    expect(sent(calls).history[0].text).toHaveLength(500);
  });

  it.each([
    [
      { kind: 'crisis', topic: null, text: null, note: null },
      { kind: 'crisis', topic: null, text: null, reachOut: false },
    ],
    [
      { kind: 'refusal', topic: 'dosing', text: null, note: null },
      { kind: 'refusal', topic: 'dosing', text: null, reachOut: false },
    ],
    [
      { kind: 'reply', topic: null, text: 'ok', note: 'reach_out' },
      { kind: 'reply', topic: null, text: 'ok', reachOut: true },
    ],
  ])('reads %j', async (body, expected) => {
    const client = createCoachClient({ baseUrl: 'http://x', fetchImpl: fakeFetch(200, body).impl });
    expect(await client.send({ lang: 'en', message: 'hi', history: [] })).toEqual(expected);
  });

  it.each([
    { kind: 'reply', topic: null, text: null },
    { kind: 'refusal', topic: 'other' },
    { kind: 'advice', text: 'x' },
    null,
  ])('treats an unexpected answer %j as a server problem', async (body) => {
    const client = createCoachClient({ baseUrl: 'http://x', fetchImpl: fakeFetch(200, body).impl });
    await expect(client.send({ lang: 'en', message: 'hi', history: [] })).rejects.toEqual(
      new CoachError('server'),
    );
  });

  it.each([
    [429, 'busy'],
    [503, 'unavailable'],
    [422, 'server'],
    [500, 'server'],
  ])('maps HTTP %d to %s', async (status, kind) => {
    const client = createCoachClient({ baseUrl: 'http://x', fetchImpl: fakeFetch(status).impl });
    await expect(client.send({ lang: 'en', message: 'hi', history: [] })).rejects.toEqual(
      new CoachError(kind as CoachError['kind']),
    );
  });

  it('reports offline when the service cannot be reached', async () => {
    const impl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const client = createCoachClient({ baseUrl: 'http://x', fetchImpl: impl });
    await expect(client.send({ lang: 'en', message: 'hi', history: [] })).rejects.toEqual(
      new CoachError('offline'),
    );
  });
});

describe('coachBaseUrl', () => {
  it('follows the same http rules as the circle server', () => {
    expect(coachBaseUrl('https://coach.example', false)).toBe('https://coach.example');
    expect(coachBaseUrl('http://192.168.1.20:8001', false)).toBeNull();
    expect(coachBaseUrl('http://localhost:8001', false)).toBe('http://localhost:8001');
    expect(coachBaseUrl('http://192.168.1.20:8001', true)).toBe('http://192.168.1.20:8001');
    expect(coachBaseUrl('', true)).toBeNull();
    expect(coachBaseUrl(undefined, true)).toBeNull();
  });
});

describe('isUnencrypted', () => {
  it('flags plain http to another computer, but not https or this computer', () => {
    expect(isUnencrypted('http://192.168.1.20:8001')).toBe(true);
    expect(isUnencrypted('https://coach.example')).toBe(false);
    expect(isUnencrypted('http://localhost:8001')).toBe(false);
    expect(isUnencrypted(null)).toBe(false);
  });
});
