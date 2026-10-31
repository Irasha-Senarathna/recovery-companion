import {
  checkCode,
  circleBaseUrl,
  CircleError,
  createCircleClient,
  formatInviteCode,
} from '../circleClient';

type Call = { url: string; method: string; headers: Record<string, string>; body?: string };

function fakeFetch(status: number, body: unknown = null) {
  const calls: Call[] = [];
  const impl = jest.fn(async (url: string, init: RequestInit = {}) => {
    calls.push({
      url,
      method: init.method ?? 'GET',
      headers: (init.headers ?? {}) as Record<string, string>,
      body: init.body as string | undefined,
    });
    return {
      ok: status >= 200 && status < 300,
      status,
      json: async () => body,
    } as Response;
  });
  return { impl, calls };
}

const TOKEN = 't'.repeat(43);

describe('circleClient', () => {
  it('creates an account with only a role and keeps the token it is given', async () => {
    const { impl, calls } = fakeFetch(201, { account_id: 'a-1', token: TOKEN, role: 'member' });
    const client = createCircleClient({ baseUrl: 'http://laptop:8000/', fetchImpl: impl });

    const creds = await client.createAccount('member');

    expect(creds).toEqual({ accountId: 'a-1', token: TOKEN, role: 'member' });
    expect(calls[0].url).toBe('http://laptop:8000/accounts');
    expect(calls[0].method).toBe('POST');
    expect(JSON.parse(calls[0].body!)).toEqual({ role: 'member' });
  });

  it('sends the token as a bearer header, never in the URL', async () => {
    const { impl, calls } = fakeFetch(200, []);
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    await client.listLinks(TOKEN);
    expect(calls[0].headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(calls[0].url).not.toContain(TOKEN);
  });

  it('sends a signal with no body at all', async () => {
    const { impl, calls } = fakeFetch(201, { created_at: 1_800_000_000, remaining_today: 2 });
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });

    expect(await client.sendSignal(TOKEN)).toEqual({ remainingToday: 2 });
    expect(calls[0].body).toBeUndefined();
    expect(calls[0].url).toBe('http://laptop:8000/signals');
  });

  it('turns server seconds into milliseconds', async () => {
    const { impl } = fakeFetch(200, [{ id: 'l-1', status: 'active', created_at: 1_800_000_000 }]);
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    expect(await client.listLinks(TOKEN)).toEqual([
      { id: 'l-1', status: 'active', createdAt: 1_800_000_000_000 },
    ]);
  });

  it('cleans a typed invite code before sending it', async () => {
    const { impl, calls } = fakeFetch(201, { link_id: 'l-1', status: 'pending' });
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    await client.redeemInvite(TOKEN, ' abcde-fghij ');
    expect(JSON.parse(calls[0].body!)).toEqual({ code: 'ABCDEFGHIJ' });
  });

  it.each([
    [404, { detail: 'not_found' }, 'notFound'],
    [409, { detail: 'circle_full' }, 'full'],
    [409, { detail: 'already_linked' }, 'alreadyLinked'],
    [409, { detail: 'no_supporters' }, 'noSupporters'],
    [429, { detail: 'daily_limit' }, 'dailyLimit'],
    [429, { detail: 'too_many_tries' }, 'tooManyTries'],
    [401, { detail: 'unauthorized' }, 'unauthorized'],
    [422, { detail: [] }, 'invalid'],
    [500, null, 'server'],
  ])('maps HTTP %s to a known error kind', async (status, body, kind) => {
    const { impl } = fakeFetch(status, body);
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    await expect(client.listLinks(TOKEN)).rejects.toMatchObject({ kind });
  });

  it('reports "offline" when the server cannot be reached', async () => {
    const impl = jest.fn(async () => {
      throw new TypeError('Network request failed');
    });
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    const error = await client.listLinks(TOKEN).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(CircleError);
    expect((error as CircleError).kind).toBe('offline');
  });

  it('treats deleting an account that is already gone as done', async () => {
    const { impl } = fakeFetch(401, { detail: 'unauthorized' });
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    await expect(client.deleteAccount(TOKEN)).resolves.toBeUndefined();
  });

  it('refuses a malformed response instead of trusting it', async () => {
    const { impl } = fakeFetch(200, [{ id: 42 }]);
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    await expect(client.listLinks(TOKEN)).rejects.toMatchObject({ kind: 'server' });
  });

  it('sends the push token and language, and nothing else', async () => {
    const { impl, calls } = fakeFetch(204);
    const client = createCircleClient({ baseUrl: 'http://laptop:8000', fetchImpl: impl });
    await client.setPushToken(TOKEN, 'ExponentPushToken[x]', 'si');
    expect(calls[0].method).toBe('PUT');
    expect(JSON.parse(calls[0].body!)).toEqual({ token: 'ExponentPushToken[x]', lang: 'si' });
  });

  it('shows invite codes in two easy-to-read halves', () => {
    expect(formatInviteCode('ABCDEFGHIJ')).toBe('ABCDE-FGHIJ');
  });
});

describe('server address', () => {
  it('needs https outside development builds, except for this computer', () => {
    expect(circleBaseUrl('https://circle.example', false)).toBe('https://circle.example');
    expect(circleBaseUrl('http://192.168.1.20:8000', false)).toBeNull();
    expect(circleBaseUrl('http://localhost:8000', false)).toBe('http://localhost:8000');
    expect(circleBaseUrl('http://192.168.1.20:8000', true)).toBe('http://192.168.1.20:8000');
  });

  it('is off when unset or not a web address', () => {
    expect(circleBaseUrl('', true)).toBeNull();
    expect(circleBaseUrl(undefined, true)).toBeNull();
    expect(circleBaseUrl('ftp://x', true)).toBeNull();
  });

  it('gives both phones the same short check code for a link', () => {
    expect(checkCode('f33132a2-0e63-41f7-993b-5bf6d5f9e419')).toBe('E419');
  });
});
