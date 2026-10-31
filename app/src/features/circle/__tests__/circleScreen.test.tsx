import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import CircleRoute from '../../../app/circle';
import CircleInviteRoute from '../../../app/circle-invite';
import HelpRoute from '../../../app/help';
import HomeRoute from '../../../app/index';
import i18n from '../../../i18n';
import type { CircleClient } from '../../../net/circleClient';
import { secureStore } from '../../../platform/secureStore';
import { SECURE_KEYS } from '../../../storage/secureKeys';
import type { Database } from '../../../storage/types';
import { createFakeCircle } from '../../../test-utils/fakeCircleClient';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { getLabels } from '../circleRepo';
import { CircleClientContext } from '../client';
import { loadCredentials } from '../credentials';

let db: Database;
let fake: ReturnType<typeof createFakeCircle>;

beforeEach(async () => {
  db = await createTestDb();
  fake = createFakeCircle();
});

function withClient(client: CircleClient | null, Screen: () => React.JSX.Element | null) {
  return function Wrapped() {
    return (
      <CircleClientContext.Provider value={client}>
        <Screen />
      </CircleClientContext.Provider>
    );
  };
}

async function render(initialUrl = '/circle', client: CircleClient | null = fake.client) {
  const session = fakeSession({ db });
  await renderRouter(
    {
      _layout: layoutWithSession(session),
      index: HomeRoute,
      circle: withClient(client, CircleRoute),
      'circle-invite': withClient(client, CircleInviteRoute),
      help: HelpRoute,
    },
    { initialUrl },
  );
  return session;
}

async function turnOn() {
  await render();
  await fireEvent.press(await screen.findByTestId('circle-turn-on'));
  await screen.findByTestId('circle-invite');
}

/** Turns the circle on, makes a code, and has a supporter join with it. */
async function withPendingSupporter() {
  await turnOn();
  await fireEvent.press(screen.getByTestId('circle-invite'));
  await fireEvent.press(await screen.findByTestId('invite-make'));
  const code = (await screen.findByTestId('invite-code')).props.children as string;
  const joined = await fake.supporterJoins(code);
  await fireEvent.press(screen.getByTestId('invite-done'));
  return joined;
}

async function approve(name: string) {
  await fireEvent.changeText(await screen.findByTestId('pending-label'), name);
  await fireEvent.press(screen.getByTestId('pending-approve'));
  await screen.findByText(name);
}

describe('support circle (member)', () => {
  it('opens from home', async () => {
    await render('/');
    await fireEvent.press(await screen.findByTestId('open-circle'));
    expect(await screen.findByTestId('circle-turn-on')).toBeOnTheScreen();
  });

  it('explains what is and is not shared before anything is created', async () => {
    await render();
    expect(await screen.findByText(i18n.t('circle.sentList'))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('circle.notSentList'))).toBeOnTheScreen();
    expect(fake.client.createAccount).not.toHaveBeenCalled();
  });

  it('creates the server account only when turned on, and keeps the token in the secure store', async () => {
    await turnOn();
    expect(fake.client.createAccount).toHaveBeenCalledWith('member');
    expect(await loadCredentials(secureStore, 'member')).not.toBeNull();
  });

  it('says so when this build has no server', async () => {
    await render('/circle', null);
    expect(await screen.findByText(i18n.t('circle.unavailable'))).toBeOnTheScreen();
  });

  it('shows an invite code that the supporter can use once', async () => {
    await turnOn();
    await fireEvent.press(screen.getByTestId('circle-invite'));
    await fireEvent.press(await screen.findByTestId('invite-make'));
    const code = (await screen.findByTestId('invite-code')).props.children as string;
    expect(code).toMatch(/^[A-Z2-7]{5}-[A-Z2-7]{5}$/);
  });

  it('approves a supporter with a name that stays on this phone', async () => {
    const { linkId } = await withPendingSupporter();
    await approve('Sister');

    expect(fake.links[0].status).toBe('active');
    expect(await getLabels(db, 'member')).toEqual(new Map([[linkId, 'Sister']]));
    // The name is never sent to the server.
    const sent = JSON.stringify((fake.client.approveLink as jest.Mock).mock.calls);
    expect(sent).not.toContain('Sister');
  });

  it('can decline someone who joined with the code', async () => {
    await withPendingSupporter();
    await fireEvent.press(await screen.findByTestId('pending-decline'));
    await waitFor(() => expect(fake.links).toHaveLength(0));
  });

  it('asks for consent every time before sending a check-in request', async () => {
    await withPendingSupporter();
    await approve('Sister');

    for (let n = 0; n < 2; n++) {
      await fireEvent.press(screen.getByTestId('circle-ask'));
      expect(await screen.findByText(i18n.t('notifications.circleBody'))).toBeOnTheScreen();
      expect(fake.client.sendSignal).toHaveBeenCalledTimes(n);
      await fireEvent.press(screen.getByTestId('circle-ask-send'));
      await screen.findByTestId('circle-ask-sent');
    }
    expect(fake.client.sendSignal).toHaveBeenCalledTimes(2);
  });

  it('cancelling the consent sends nothing', async () => {
    await withPendingSupporter();
    await approve('Sister');
    await fireEvent.press(screen.getByTestId('circle-ask'));
    await fireEvent.press(await screen.findByTestId('circle-ask-cancel'));
    expect(fake.client.sendSignal).not.toHaveBeenCalled();
  });

  it('cannot ask before anyone is approved', async () => {
    await withPendingSupporter();
    expect(screen.queryByTestId('circle-ask')).toBeNull();
    expect(screen.getByText(i18n.t('circle.askNeedsSupporter'))).toBeOnTheScreen();
  });

  it('after sending, offers help that does not wait for the circle', async () => {
    await withPendingSupporter();
    await approve('Sister');
    await fireEvent.press(screen.getByTestId('circle-ask'));
    await fireEvent.press(await screen.findByTestId('circle-ask-send'));
    expect(await screen.findByText(i18n.t('circle.sent'))).toBeOnTheScreen();
    expect(screen.getByTestId('reach-help')).toBeOnTheScreen();
    expect(screen.getByTestId('reach-sos')).toBeOnTheScreen();
  });

  it('at the limit, replaces the ask button with direct help', async () => {
    await withPendingSupporter();
    await approve('Sister');
    for (let n = 0; n < 3; n++) {
      await fireEvent.press(screen.getByTestId('circle-ask'));
      await fireEvent.press(await screen.findByTestId('circle-ask-send'));
      await screen.findByTestId('circle-ask-sent');
    }
    expect(screen.queryByTestId('circle-ask')).toBeNull();
    expect(screen.getByTestId('reach-help')).toBeOnTheScreen();
  });

  it('explains the limit kindly when the server says it is reached', async () => {
    const { linkId } = await withPendingSupporter();
    await approve('Sister');
    const [token] = [...fake.accounts.entries()].find(([, a]) => a.role === 'member')!;
    for (let n = 0; n < 3; n++) await fake.client.sendSignal(token);
    expect(linkId).toBeTruthy();
    await fireEvent.press(screen.getByTestId('circle-ask'));
    await fireEvent.press(await screen.findByTestId('circle-ask-send'));
    expect(await screen.findByText(i18n.t('circle.errors.dailyLimit'))).toBeOnTheScreen();
    expect(screen.getByTestId('reach-help')).toBeOnTheScreen();
    expect(screen.queryByTestId('circle-ask')).toBeNull();
  });

  it('shows the same check code the supporter sees before approving', async () => {
    const { linkId } = await withPendingSupporter();
    const check = linkId.replace(/-/g, '').slice(-4).toUpperCase();
    expect(await screen.findByText(i18n.t('circle.pendingHint', { check }))).toBeOnTheScreen();
  });

  it('removes a supporter after a confirmation', async () => {
    await withPendingSupporter();
    await approve('Sister');
    await fireEvent.press(screen.getByTestId('remove-supporter'));
    await fireEvent.press(await screen.findByTestId('remove-supporter-confirm'));
    await waitFor(() => expect(fake.links).toHaveLength(0));
    expect(await getLabels(db, 'member')).toEqual(new Map());
  });

  it('turning off deletes the server account, the token and the labels', async () => {
    await withPendingSupporter();
    await approve('Sister');
    await fireEvent.press(screen.getByTestId('circle-turn-off'));
    await fireEvent.press(await screen.findByTestId('circle-turn-off-confirm'));

    expect(await screen.findByTestId('circle-turn-on')).toBeOnTheScreen();
    expect(await secureStore.get(SECURE_KEYS.circleMember)).toBeNull();
    expect(await getLabels(db, 'member')).toEqual(new Map());
    expect([...fake.accounts.values()].map((a) => a.role)).toEqual(['supporter']);
  });

  it('shows a calm message when the server cannot be reached', async () => {
    await turnOn();
    fake.setOffline(true);
    await fireEvent.press(screen.getByTestId('circle-invite'));
    await fireEvent.press(await screen.findByTestId('invite-make'));
    expect(await screen.findByText(i18n.t('circle.errors.offline'))).toBeOnTheScreen();
  });

  it('every circle screen keeps the help button', async () => {
    await render();
    expect(await screen.findByTestId('help-button')).toBeOnTheScreen();
  });
});
