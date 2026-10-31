import {
  CircleError,
  cleanInviteCode,
  type CircleClient,
  type CircleRole,
  type LinkInfo,
} from '../net/circleClient';

const BASE32 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';

type Account = { id: string; role: CircleRole; pushToken: string | null; lang: string | null };
type Link = LinkInfo & { memberId: string; supporterId: string };

/**
 * An in-memory stand-in for the support-circle server, following its rules
 * (max 3 supporters, single-use codes, 3 signals a day, approval needed).
 */
export function createFakeCircle() {
  let next = 1;
  const id = (prefix: string) => `${prefix}-${next++}`;
  const accounts = new Map<string, Account>(); // by token
  const invites = new Map<string, string>(); // code -> member id
  const links: Link[] = [];
  const signals: { memberId: string; createdAt: number }[] = [];
  let offline = false;

  const who = (token: string): Account => {
    if (offline) throw new CircleError('offline');
    const account = accounts.get(token);
    if (!account) throw new CircleError('unauthorized');
    return account;
  };
  const mine = (account: Account) =>
    links.filter((l) => (account.role === 'member' ? l.memberId : l.supporterId) === account.id);
  const plain = ({ id: linkId, status, createdAt }: Link): LinkInfo => ({
    id: linkId,
    status,
    createdAt,
  });
  const find = (account: Account, linkId: string) => {
    const link = mine(account).find((l) => l.id === linkId);
    if (!link) throw new CircleError('notFound');
    return link;
  };

  const client: CircleClient = {
    createAccount: jest.fn(async (role: CircleRole) => {
      if (offline) throw new CircleError('offline');
      const token = id('token');
      const account = { id: id('acct'), role, pushToken: null, lang: null };
      accounts.set(token, account);
      return { accountId: account.id, token, role };
    }),
    deleteAccount: jest.fn(async (token: string) => {
      if (offline) throw new CircleError('offline');
      const account = accounts.get(token);
      if (!account) return;
      accounts.delete(token);
      for (let i = links.length - 1; i >= 0; i--) {
        if (links[i].memberId === account.id || links[i].supporterId === account.id) {
          links.splice(i, 1);
        }
      }
    }),
    createInvite: jest.fn(async (token: string) => {
      const account = who(token);
      if (account.role !== 'member') throw new CircleError('server');
      if (mine(account).length >= 3) throw new CircleError('full');
      for (const [code, memberId] of invites) if (memberId === account.id) invites.delete(code);
      const seed = next++;
      const code = Array.from({ length: 10 }, (_, i) => BASE32[(seed * 7 + i * 3) % 32]).join('');
      invites.set(code, account.id);
      return { code, expiresAt: Date.now() + 24 * 3600 * 1000 };
    }),
    redeemInvite: jest.fn(async (token: string, typed: string) => {
      const account = who(token);
      const memberId = invites.get(cleanInviteCode(typed));
      if (!memberId) throw new CircleError('notFound');
      if (links.filter((l) => l.memberId === memberId).length >= 3) {
        throw new CircleError('full');
      }
      if (links.some((l) => l.memberId === memberId && l.supporterId === account.id)) {
        throw new CircleError('alreadyLinked');
      }
      invites.delete(cleanInviteCode(typed));
      const link = {
        id: id('link'),
        status: 'pending' as const,
        createdAt: Date.now(),
        memberId,
        supporterId: account.id,
      };
      links.push(link);
      return { linkId: link.id };
    }),
    listLinks: jest.fn(async (token: string) => mine(who(token)).map(plain)),
    approveLink: jest.fn(async (token: string, linkId: string) => {
      find(who(token), linkId).status = 'active';
    }),
    revokeLink: jest.fn(async (token: string, linkId: string) => {
      links.splice(links.indexOf(find(who(token), linkId)), 1);
    }),
    sendSignal: jest.fn(async (token: string) => {
      const account = who(token);
      if (!mine(account).some((l) => l.status === 'active')) {
        throw new CircleError('noSupporters');
      }
      const today = signals.filter((s) => s.memberId === account.id).length;
      if (today >= 3) throw new CircleError('dailyLimit');
      signals.push({ memberId: account.id, createdAt: Date.now() });
      return { remainingToday: 2 - today };
    }),
    listSignals: jest.fn(async (token: string) => {
      const account = who(token);
      return mine(account)
        .filter((l) => l.status === 'active')
        .flatMap((l) =>
          signals
            .filter((s) => s.memberId === l.memberId)
            .map((s) => ({ linkId: l.id, createdAt: s.createdAt })),
        );
    }),
    setPushToken: jest.fn(async (token: string, pushToken: string, lang: string) => {
      Object.assign(who(token), { pushToken, lang });
    }),
    removePushToken: jest.fn(async (token: string) => {
      Object.assign(who(token), { pushToken: null, lang: null });
    }),
  };

  return {
    client,
    accounts,
    links,
    signals,
    setOffline: (value: boolean) => {
      offline = value;
    },
    /** A supporter (on another phone) redeems the member's code. */
    async supporterJoins(code: string) {
      const creds = await client.createAccount('supporter');
      return { creds, ...(await client.redeemInvite(creds.token, code)) };
    },
  };
}
