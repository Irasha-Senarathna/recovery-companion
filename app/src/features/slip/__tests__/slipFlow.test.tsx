import { fireEvent, renderRouter, screen, waitFor } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';
import HelpRoute from '../../../app/help';
import ProgressRoute from '../../../app/progress';
import SlipRoute from '../../../app/slip';
import i18n from '../../../i18n';
import { DEFAULT_SETTINGS } from '../../../storage/settings';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { localDay } from '../../checkin/checkinRepo';
import { addDays } from '../progress';
import { listSlips } from '../slipRepo';

let db: Database;
const TODAY = localDay();

beforeEach(async () => {
  db = await createTestDb();
  // Deterministic: no count-up animation running while the test taps through.
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

async function render(initialUrl = '/slip', settings = {}) {
  const session = fakeSession({
    db,
    settings: {
      ...DEFAULT_SETTINGS,
      nickname: 'Sky',
      onboarded: true,
      journeyStart: addDays(TODAY, -45),
      ...settings,
    },
  });
  await renderRouter(
    {
      _layout: layoutWithSession(session),
      slip: SlipRoute,
      progress: ProgressRoute,
      help: HelpRoute,
    },
    { initialUrl },
  );
  return session;
}

async function saveSlip() {
  await fireEvent.press(await screen.findByTestId('slip-save'));
  await screen.findByTestId('slip-counted');
}

async function skipAllQuestions() {
  for (let n = 0; n < 3; n++) await fireEvent.press(await screen.findByTestId('slip-skip'));
}

describe('slip flow', () => {
  it('opens gently from the progress screen', async () => {
    await render('/progress');
    await fireEvent.press(await screen.findByTestId('open-slip'));
    expect(await screen.findByTestId('slip-save')).toBeOnTheScreen();
  });

  it('starts with care, and points to urgent help first', async () => {
    await render();
    expect(await screen.findByText(i18n.t('slip.welcomeBody'))).toBeOnTheScreen();
    expect(screen.getByText(i18n.t('slip.unwell'))).toBeOnTheScreen();
    expect(screen.getByTestId('slip-unwell-help')).toBeOnTheScreen();
    expect(screen.getByTestId('help-button')).toBeOnTheScreen();
  });

  it('says the strong days still count after saving (they never reset)', async () => {
    await render();
    await saveSlip();
    expect(await screen.findByText(i18n.t('slip.stillCounts', { count: 45 }))).toBeOnTheScreen();
    expect((await listSlips(db)).map((s) => s.day)).toEqual([TODAY]);
  });

  it('can log a slip for yesterday instead', async () => {
    await render();
    await fireEvent.press(await screen.findByTestId('slip-day-yesterday'));
    await saveSlip();
    expect((await listSlips(db)).map((s) => s.day)).toEqual([addDays(TODAY, -1)]);
    expect(await screen.findByText(i18n.t('slip.stillCounts', { count: 44 }))).toBeOnTheScreen();
  });

  it('every question can be skipped, and nothing is required', async () => {
    await render();
    await saveSlip();
    await fireEvent.press(screen.getByTestId('slip-continue'));
    await skipAllQuestions();
    expect(await screen.findByTestId('slip-reach')).toBeOnTheScreen();
    const [slip] = await listSlips(db);
    expect(slip).toMatchObject({ place: null, feelings: [], before: [] });
  });

  it('the questions can all be skipped at once', async () => {
    await render();
    await saveSlip();
    await fireEvent.press(screen.getByTestId('slip-skip-questions'));
    expect(await screen.findByTestId('slip-reach')).toBeOnTheScreen();
  });

  it('saves the chosen answers as fixed options', async () => {
    await render();
    await saveSlip();
    await fireEvent.press(screen.getByTestId('slip-continue'));
    await fireEvent.press(await screen.findByTestId('slip-place-friends'));
    await fireEvent.press(screen.getByTestId('slip-next'));
    await fireEvent.press(await screen.findByTestId('slip-feelings-lonely'));
    await fireEvent.press(screen.getByTestId('slip-feelings-tired'));
    await fireEvent.press(screen.getByTestId('slip-next'));
    await fireEvent.press(await screen.findByTestId('slip-before-argument'));
    await fireEvent.press(screen.getByTestId('slip-next'));

    await screen.findByTestId('slip-reach');
    await waitFor(async () =>
      expect((await listSlips(db))[0]).toMatchObject({
        place: 'friends',
        feelings: ['lonely', 'tired'],
        before: ['argument'],
      }),
    );
  });

  it('ends by suggesting someone to reach out to', async () => {
    await render();
    await saveSlip();
    await fireEvent.press(screen.getByTestId('slip-skip-questions'));
    expect(await screen.findByText(i18n.t('slip.reachTitle'))).toBeOnTheScreen();
    expect(screen.getByTestId('sos-add-support')).toBeOnTheScreen();
    expect(screen.getByTestId('sos-get-help')).toBeOnTheScreen();
    expect(screen.getByTestId('slip-circle')).toBeOnTheScreen();
    expect(screen.getByTestId('slip-plan')).toBeOnTheScreen();
  });

  it('offers to call the support person when there is one', async () => {
    await render('/slip', { supportName: 'Amma', supportPhone: '0771234567' });
    await saveSlip();
    await fireEvent.press(screen.getByTestId('slip-skip-questions'));
    expect(await screen.findByTestId('sos-call-support')).toBeOnTheScreen();
  });

  it('a first-day slip still gets a kind message, not a zero', async () => {
    await render('/slip', { journeyStart: TODAY });
    await saveSlip();
    expect(await screen.findByText(i18n.t('slip.firstDay'))).toBeOnTheScreen();
  });

  it('the "unwell" button opens help with the urgent message', async () => {
    await render();
    await fireEvent.press(await screen.findByTestId('slip-unwell-help'));
    expect(await screen.findByTestId('crisis-message')).toBeOnTheScreen();
  });

  it('a slip logged by mistake can be removed straight away', async () => {
    await render('/progress');
    await fireEvent.press(await screen.findByTestId('open-slip'));
    await saveSlip();
    await fireEvent.press(screen.getByTestId('slip-undo'));
    await fireEvent.press(await screen.findByTestId('slip-undo-confirm'));
    await waitFor(async () => expect(await listSlips(db)).toEqual([]));
  });

  it('a first-day slip shows words, not an empty ring with a zero', async () => {
    await render('/slip', { journeyStart: TODAY });
    await saveSlip();
    expect(screen.queryByText('0')).toBeNull();
  });
});
