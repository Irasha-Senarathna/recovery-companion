import { act, fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import CoachRoute from '../../../app/coach';
import HelpRoute from '../../../app/help';
import HomeRoute from '../../../app/index';
import i18n from '../../../i18n';
import { CoachError, type CoachClient, type CoachReply } from '../../../net/coachClient';
import { DEFAULT_SETTINGS } from '../../../storage/settings';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { CoachClientContext } from '../client';

const REPLY: CoachReply = {
  kind: 'reply',
  topic: null,
  text: 'That sounds hard. Shall we breathe together?',
  reachOut: false,
};

function fakeClient(answer: CoachReply | CoachError = REPLY) {
  const send = jest.fn(async () => {
    if (answer instanceof CoachError) throw answer;
    return answer;
  });
  return { send } satisfies CoachClient;
}

async function render({
  enabled = true,
  client = fakeClient() as CoachClient | null,
  initialUrl = '/coach',
} = {}) {
  const session = fakeSession({
    settings: { ...DEFAULT_SETTINGS, nickname: 'Sky', onboarded: true, coachEnabled: enabled },
  });
  function Coach() {
    return (
      <CoachClientContext.Provider value={client}>
        <CoachRoute />
      </CoachClientContext.Provider>
    );
  }
  await renderRouter(
    { _layout: layoutWithSession(session), index: HomeRoute, coach: Coach, help: HelpRoute },
    { initialUrl },
  );
  return session;
}

async function send(text: string) {
  await fireEvent.changeText(await screen.findByTestId('coach-input'), text);
  await fireEvent.press(screen.getByTestId('coach-send'));
}

afterEach(() => i18n.changeLanguage('en'));

describe('coach opt-in', () => {
  it('opens from home', async () => {
    await render({ enabled: false, initialUrl: '/' });
    await fireEvent.press(await screen.findByTestId('open-coach'));
    expect(await screen.findByTestId('coach-opt-in')).toBeOnTheScreen();
  });

  it('is off by default', () => {
    expect(DEFAULT_SETTINGS.coachEnabled).toBe(false);
  });

  it('says what is sent and that the coach is not a therapist, before anything is sent', async () => {
    const client = fakeClient();
    const session = await render({ enabled: false, client });
    expect(await screen.findByText(i18n.t('coach.notTherapist'))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('coach.sentList'))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('coach.notSentList'))).toBeOnTheScreen();
    expect(screen.queryByTestId('coach-input')).toBeNull();

    await fireEvent.press(screen.getByTestId('coach-turn-on'));
    expect(session.updateSettings).toHaveBeenCalledWith({ coachEnabled: true });
    expect(client.send).not.toHaveBeenCalled();
  });

  it('says when this build has no coach service', async () => {
    await render({ enabled: false, client: null });
    expect(await screen.findByText(i18n.t('coach.unavailable'))).toBeOnTheScreen();
    expect(screen.queryByTestId('coach-turn-on')).toBeNull();
  });
});

describe('coach chat', () => {
  it('sends the message with the app language and shows the reply', async () => {
    const client = fakeClient();
    await render({ client });
    await send('I had a craving after work');

    expect(await screen.findByText(REPLY.text as string)).toBeOnTheScreen();
    expect(client.send).toHaveBeenCalledWith({
      lang: 'en',
      message: 'I had a craving after work',
      history: [],
    });
    expect(screen.getByText(i18n.t('coach.notTherapist'))).toBeOnTheScreen();
  });

  it('sends earlier turns of this chat as history', async () => {
    const client = fakeClient();
    await render({ client });
    await send('first');
    await screen.findByText(REPLY.text as string);
    await send('second');

    await waitFor(() => expect(client.send).toHaveBeenCalledTimes(2));
    expect(client.send).toHaveBeenLastCalledWith({
      lang: 'en',
      message: 'second',
      history: [
        { role: 'user', text: 'first' },
        { role: 'coach', text: REPLY.text },
      ],
    });
  });

  it('never sends crisis words: help opens on the phone instead (safety rule 4)', async () => {
    const client = fakeClient();
    await render({ client });
    await fireEvent.changeText(await screen.findByTestId('coach-input'), 'I want to end my life');
    expect(await screen.findByTestId('crisis-message')).toBeOnTheScreen();
    expect(client.send).not.toHaveBeenCalled();
  });

  it('opens help and pauses the coach when the service finds crisis words', async () => {
    const client = fakeClient({ kind: 'crisis', topic: null, text: null, reachOut: false });
    await render({ client });
    await send('something heavy');
    expect(await screen.findByTestId('crisis-message')).toBeOnTheScreen();
  });

  it.each(['dosing', 'medical', 'withdrawal', 'drug_use', 'rules'] as const)(
    'answers a %s question with a kind refusal and other help',
    async (topic) => {
      await render({ client: fakeClient({ kind: 'refusal', topic, text: null, reachOut: false }) });
      await send('a question');
      expect(await screen.findByText(i18n.t(`coach.refusal.${topic}`))).toBeOnTheScreen();
      expect(screen.getAllByTestId('coach-open-sos').length).toBeGreaterThan(0);
      expect(screen.getAllByTestId('coach-open-help').length).toBeGreaterThan(0);
    },
  );

  it('shows the safe fallback when the reply did not pass the checks', async () => {
    await render({
      client: fakeClient({ kind: 'fallback', topic: null, text: null, reachOut: false }),
    });
    await send('hello');
    expect(await screen.findByText(i18n.t('coach.fallback'))).toBeOnTheScreen();
  });

  it('gently points to people when the user leans only on the coach', async () => {
    await render({ client: fakeClient({ ...REPLY, reachOut: true }) });
    await send("you're the only one I can talk to");
    expect(await screen.findByText(i18n.t('coach.reachOut'))).toBeOnTheScreen();
  });

  it.each(['offline', 'busy', 'unavailable', 'server'] as const)(
    'explains a %s error and offers help that does not need the coach',
    async (kind) => {
      await render({ client: fakeClient(new CoachError(kind)) });
      await send('hello');
      expect(await screen.findByText(i18n.t(`coach.errors.${kind}`))).toBeOnTheScreen();
      expect(screen.getByTestId('coach-open-sos')).toBeOnTheScreen();
    },
  );

  it('clears the chat', async () => {
    await render();
    await send('hello');
    await screen.findByText(REPLY.text as string);
    await fireEvent.press(screen.getByTestId('coach-clear'));
    expect(screen.queryByText(REPLY.text as string)).toBeNull();
  });

  it('can be turned off', async () => {
    const session = await render();
    await fireEvent.press(await screen.findByTestId('coach-turn-off'));
    expect(session.updateSettings).toHaveBeenCalledWith({ coachEnabled: false });
  });

  it('does not send an empty message', async () => {
    const client = fakeClient();
    await render({ client });
    await send('   ');
    expect(client.send).not.toHaveBeenCalled();
  });

  it('replies in the app language', async () => {
    await i18n.changeLanguage('ta');
    const client = fakeClient();
    await render({ client });
    await send('வணக்கம்');
    await waitFor(() => expect(client.send).toHaveBeenCalled());
    expect(client.send).toHaveBeenCalledWith(expect.objectContaining({ lang: 'ta' }));
  });
});

describe('coach after a crisis', () => {
  it('shows the paused card instead of the message box', async () => {
    const { CoachChat } = jest.requireActual('../CoachScreen');
    const client = fakeClient({ kind: 'crisis', topic: null, text: null, reachOut: false });
    const session = fakeSession({
      settings: { ...DEFAULT_SETTINGS, onboarded: true, coachEnabled: true },
    });
    await renderRouter(
      {
        _layout: layoutWithSession(session),
        coach: () => <CoachChat client={client} onTurnOff={jest.fn()} openHelp={jest.fn()} />,
      },
      { initialUrl: '/coach' },
    );
    await send('something heavy');
    expect(await screen.findByTestId('coach-paused')).toBeOnTheScreen();
    expect(screen.queryByTestId('coach-input')).toBeNull();
    expect(screen.getAllByTestId('coach-open-help').length).toBeGreaterThan(0);
  });

  it('ignores a reply that arrives after the chat was cleared', async () => {
    const { CoachChat } = jest.requireActual('../CoachScreen');
    let answer: (reply: CoachReply) => void = () => {};
    const client: CoachClient = {
      send: jest.fn(() => new Promise<CoachReply>((resolve) => (answer = resolve))),
    };
    const session = fakeSession();
    await renderRouter(
      {
        _layout: layoutWithSession(session),
        coach: () => <CoachChat client={client} onTurnOff={jest.fn()} openHelp={jest.fn()} />,
      },
      { initialUrl: '/coach' },
    );
    await fireEvent.changeText(await screen.findByTestId('coach-input'), 'hello');
    // Not awaited: the reply is held back until after Clear.
    const pressing = fireEvent.press(screen.getByTestId('coach-send'));
    await waitFor(() => expect(client.send).toHaveBeenCalled());
    await fireEvent.press(screen.getByTestId('coach-clear'));
    expect(screen.queryByTestId('coach-thinking')).toBeNull();
    await act(async () => {
      answer(REPLY);
      await pressing;
    });
    expect(screen.queryByText(REPLY.text as string)).toBeNull();
  });
});
