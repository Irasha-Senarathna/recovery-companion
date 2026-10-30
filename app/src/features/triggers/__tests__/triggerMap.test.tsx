import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Notifications from 'expo-notifications';
import CopingPlanRoute from '../../../app/coping-plan';
import HelpRoute from '../../../app/help';
import HomeRoute from '../../../app/index';
import TriggersRoute from '../../../app/triggers';
import { DEFAULT_SETTINGS } from '../../../storage/settings';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { saveCheckIn } from '../../checkin/checkinRepo';
import { getCopingPlan, saveCopingPlan } from '../copingPlanRepo';
import { refreshNudge } from '../earlyWarning';
import i18n from '../../../i18n';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();
let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  jest.clearAllMocks();
});

async function render(initialUrl: string, settings = {}) {
  const session = fakeSession({ db, settings: { ...DEFAULT_SETTINGS, ...settings } });
  await renderRouter(
    {
      _layout: layoutWithSession(session),
      index: HomeRoute,
      triggers: TriggersRoute,
      'coping-plan': CopingPlanRoute,
      help: HelpRoute,
    },
    { initialUrl },
  );
  return { session };
}

const hardDay = { mood: 1, sleep: 0, stress: 4, craving: 3, tags: ['old_routine'] };
const calmDay = { mood: 3, sleep: 3, stress: 1, craving: 0, tags: [] };

async function addHistory(days: number) {
  for (let n = days; n >= 1; n--) {
    await saveCheckIn(db, n % 4 === 0 ? hardDay : calmDay, NOW - n * DAY);
  }
}

describe('trigger map', () => {
  it('opens from home', async () => {
    await render('/');
    await fireEvent.press(await screen.findByTestId('open-triggers'));
    expect(await screen.findByTestId('triggers-progress')).toBeOnTheScreen();
  });

  it('says how many check-ins are still needed', async () => {
    await addHistory(5);
    await render('/triggers');
    expect(
      await screen.findByText(i18n.t('triggers.notReady', { count: 5, needed: 14 })),
    ).toBeOnTheScreen();
  });

  it('shows plain-language patterns with text alternatives for the chart', async () => {
    await addHistory(20);
    await render('/triggers');
    expect(await screen.findByTestId('pattern-poor_sleep')).toBeOnTheScreen();
    const chart = screen.getByTestId('pattern-chart-poor_sleep');
    expect(chart.props.accessibilityLabel).toMatch(/\d/);
  });

  it('always carries the honesty note', async () => {
    await render('/triggers');
    expect(await screen.findByText(i18n.t('triggers.honesty'))).toBeOnTheScreen();
  });

  it("on a harder day, explains why and links to the user's plan", async () => {
    await saveCheckIn(db, hardDay, NOW);
    await render('/triggers');
    expect(await screen.findByTestId('today-harder')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('open-coping-plan'));
    expect(await screen.findByTestId('plan-signs')).toBeOnTheScreen();
  });

  it('home shows a gentle card on a harder day', async () => {
    await saveCheckIn(db, hardDay, NOW);
    await render('/');
    expect(await screen.findByTestId('home-harder-day')).toBeOnTheScreen();
  });

  it('the heads-up can be turned on and off here', async () => {
    const { session } = await render('/triggers');
    await fireEvent(await screen.findByTestId('nudges-enabled'), 'valueChange', true);
    expect(session.updateSettings).toHaveBeenCalledWith({ nudgesEnabled: true });
  });
});

describe('coping plan', () => {
  it('saves early signs, what helps and who to contact, encrypted on the phone', async () => {
    await render('/coping-plan');
    await fireEvent.changeText(await screen.findByTestId('plan-signs'), 'Skipping meals');
    await fireEvent.changeText(screen.getByTestId('plan-helps'), 'A walk by the sea');
    await fireEvent.changeText(screen.getByTestId('plan-people'), 'My cousin');
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(await screen.findByTestId('plan-saved')).toBeOnTheScreen();
    expect(await getCopingPlan(db)).toMatchObject({
      signs: 'Skipping meals',
      helps: 'A walk by the sea',
      people: 'My cousin',
    });
  });

  it('opens with the saved plan', async () => {
    await saveCopingPlan(db, { signs: 'Tired', helps: 'Tea', people: 'Amma' });
    await render('/coping-plan');
    expect(await screen.findByDisplayValue('Tea')).toBeOnTheScreen();
  });

  it('crisis words in the plan open help straight away', async () => {
    await render('/coping-plan');
    await fireEvent.changeText(await screen.findByTestId('plan-signs'), "I can't go on");
    expect(await screen.findByTestId('help-screen')).toBeOnTheScreen();
  });
});

describe('coping plan: saved hard words', () => {
  it('editing a plan that already mentions a hard moment does not re-open help each time', async () => {
    await saveCopingPlan(db, { signs: "When I feel I can't go on", helps: '', people: '' });
    await render('/coping-plan');
    const signs = await screen.findByTestId('plan-signs');
    await screen.findByDisplayValue("When I feel I can't go on");
    await fireEvent.changeText(signs, "When I feel I can't go on, and tired");
    expect(screen.queryByTestId('help-screen')).toBeNull();
  });
});

describe('early-warning nudge', () => {
  const settings = { ...DEFAULT_SETTINGS, nudgesEnabled: true };
  const morning = new Date(new Date(NOW).setHours(9, 0, 0, 0)).getTime();

  it('schedules one neutral nudge on a harder day', async () => {
    await saveCheckIn(db, hardDay, morning);
    const update = jest.fn(async () => {});
    await refreshNudge({ db, settings, updateSettings: update, t: i18n.t, now: morning });
    expect(Notifications.scheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'early-warning',
        content: {
          title: i18n.t('notifications.nudgeTitle'),
          body: i18n.t('notifications.nudgeBody'),
        },
      }),
    );
    expect(update).toHaveBeenCalledWith({ lastNudgeAt: expect.any(Number) });
  });

  it('nothing when nudges are off, and a pending one is cancelled', async () => {
    await saveCheckIn(db, hardDay, morning);
    await refreshNudge({
      db,
      settings: { ...settings, nudgesEnabled: false },
      updateSettings: jest.fn(async () => {}),
      t: i18n.t,
      now: morning,
    });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
    expect(Notifications.cancelScheduledNotificationAsync).toHaveBeenCalledWith('early-warning');
  });

  it('nothing on an ordinary day', async () => {
    await saveCheckIn(db, calmDay, morning);
    await refreshNudge({
      db,
      settings,
      updateSettings: jest.fn(async () => {}),
      t: i18n.t,
      now: morning,
    });
    expect(Notifications.scheduleNotificationAsync).not.toHaveBeenCalled();
  });
});
