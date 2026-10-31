import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import * as Notifications from 'expo-notifications';
import HelpRoute from '../../../app/help';
import SupporterRoute from '../../../app/supporter';
import i18n from '../../../i18n';
import type { Database } from '../../../storage/types';
import { createFakeCircle } from '../../../test-utils/fakeCircleClient';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { getLabels } from '../circleRepo';
import { CircleClientContext } from '../client';

let db: Database;
let fake: ReturnType<typeof createFakeCircle>;
let memberToken: string;

beforeEach(async () => {
  db = await createTestDb();
  fake = createFakeCircle();
  jest.clearAllMocks();
  memberToken = (await fake.client.createAccount('member')).token;
});

async function render(settings = {}) {
  const session = fakeSession({ db, settings: { ...fakeSession().settings, ...settings } });
  function Supporter() {
    return (
      <CircleClientContext.Provider value={fake.client}>
        <SupporterRoute />
      </CircleClientContext.Provider>
    );
  }
  await renderRouter(
    { _layout: layoutWithSession(session), supporter: Supporter, help: HelpRoute },
    { initialUrl: '/supporter' },
  );
  return session;
}

async function join(code: string, name = 'Ravi') {
  await fireEvent.changeText(await screen.findByTestId('join-code'), code);
  await fireEvent.changeText(screen.getByTestId('join-label'), name);
  await fireEvent.press(screen.getByTestId('join-submit'));
}

describe('supporter mode', () => {
  it('joins with a code and waits for approval', async () => {
    const { code } = await fake.client.createInvite(memberToken);
    await render();
    await join(code.toLowerCase());

    expect(await screen.findByText(i18n.t('supporter.waiting'))).toBeOnTheScreen();
    expect(fake.client.createAccount).toHaveBeenLastCalledWith('supporter');
    const [linkId] = (await getLabels(db, 'supporter')).keys();
    expect(fake.links[0].id).toBe(linkId);
  });

  it('never sends the name to the server', async () => {
    const { code } = await fake.client.createInvite(memberToken);
    await render();
    await join(code, 'Ravi');
    await screen.findByText(i18n.t('supporter.waiting'));
    const calls = Object.values(fake.client).flatMap((fn) => (fn as jest.Mock).mock.calls);
    expect(JSON.stringify(calls)).not.toContain('Ravi');
  });

  it('explains a wrong or old code', async () => {
    await render();
    await join('AAAAA-AAAAA');
    expect(await screen.findByText(i18n.t('circle.errors.notFound'))).toBeOnTheScreen();
  });

  it('shows check-in requests by the name chosen on this phone', async () => {
    const { code } = await fake.client.createInvite(memberToken);
    await render();
    await join(code, 'Ravi');
    await screen.findByText(i18n.t('supporter.waiting'));
    const [link] = await fake.client.listLinks(memberToken);
    await fake.client.approveLink(memberToken, link.id);
    await fake.client.sendSignal(memberToken);

    await fireEvent.press(screen.getByTestId('supporter-check'));
    expect(await screen.findByTestId('request-0')).toHaveTextContent(/Ravi/);
  });

  it('asks for a push token only after the supporter opts in', async () => {
    const getToken = Notifications.getExpoPushTokenAsync as jest.Mock;
    const { code } = await fake.client.createInvite(memberToken);
    const session = await render();
    await join(code);
    await screen.findByText(i18n.t('supporter.waiting'));
    expect(getToken).not.toHaveBeenCalled();

    await fireEvent(screen.getByTestId('supporter-notify'), 'valueChange', true);

    await waitFor(() => expect(getToken).toHaveBeenCalledTimes(1));
    await waitFor(() =>
      expect(session.updateSettings).toHaveBeenCalledWith({ circleNotify: true }),
    );
    const [account] = [...fake.accounts.values()].filter((a) => a.role === 'supporter');
    expect(account).toMatchObject({ pushToken: 'ExponentPushToken[test]', lang: 'en' });
  });

  it('turning notifications off removes the token on the server and the phone', async () => {
    const { code } = await fake.client.createInvite(memberToken);
    const session = await render({ circleNotify: true });
    await join(code);
    await screen.findByText(i18n.t('supporter.waiting'));
    await fireEvent(screen.getByTestId('supporter-notify'), 'valueChange', false);
    await waitFor(() => expect(fake.client.removePushToken).toHaveBeenCalled());
    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalled();
    expect(session.updateSettings).toHaveBeenCalledWith({ circleNotify: false });
  });

  it('can stop supporting someone', async () => {
    const { code } = await fake.client.createInvite(memberToken);
    await render();
    await join(code);
    await fireEvent.press(await screen.findByTestId('stop-supporting'));
    await fireEvent.press(await screen.findByTestId('stop-supporting-confirm'));
    await waitFor(() => expect(fake.links).toHaveLength(0));
  });

  it('can leave supporter mode, deleting the account', async () => {
    const { code } = await fake.client.createInvite(memberToken);
    await render();
    await join(code);
    await fireEvent.press(await screen.findByTestId('supporter-leave'));
    await fireEvent.press(await screen.findByTestId('supporter-leave-confirm'));
    await waitFor(() => expect([...fake.accounts.values()].map((a) => a.role)).toEqual(['member']));
    expect(Notifications.unregisterForNotificationsAsync).toHaveBeenCalled();
  });
});
