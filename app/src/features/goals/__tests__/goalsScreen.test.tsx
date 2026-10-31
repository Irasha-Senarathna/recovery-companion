import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import * as Haptics from 'expo-haptics';
import { AccessibilityInfo } from 'react-native';
import GoalsRoute from '../../../app/goals';
import HelpRoute from '../../../app/help';
import i18n from '../../../i18n';
import { DEFAULT_SETTINGS } from '../../../storage/settings';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { localDay } from '../../checkin/checkinRepo';
import { addDays } from '../../slip/progress';
import { listGoals } from '../goalsRepo';

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  jest.clearAllMocks();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

async function render(settings = {}) {
  const session = fakeSession({
    db,
    settings: {
      ...DEFAULT_SETTINGS,
      onboarded: true,
      journeyStart: addDays(localDay(), -10),
      ...settings,
    },
  });
  await renderRouter(
    { _layout: layoutWithSession(session), goals: GoalsRoute, help: HelpRoute },
    { initialUrl: '/goals' },
  );
  return session;
}

describe('goals screen', () => {
  it('adds a goal from an idea, in one of the five areas', async () => {
    await render();
    await fireEvent.press(await screen.findByTestId('goal-area-sleep'));
    await fireEvent.press(screen.getByTestId('goal-idea-0'));
    await fireEvent.press(screen.getByTestId('goal-add'));
    expect(await screen.findByText(i18n.t('goals.ideas.sleep.one'))).toBeOnTheScreen();
    expect((await listGoals(db))[0]).toMatchObject({ area: 'sleep' });
  });

  it('celebrates the first small win, with a success haptic', async () => {
    await render();
    await fireEvent.press(await screen.findByTestId('goal-area-family'));
    await fireEvent.changeText(screen.getByTestId('goal-title'), 'Call my sister');
    await fireEvent.press(screen.getByTestId('goal-add'));
    const [goal] = await listGoals(db);
    await fireEvent.press(await screen.findByTestId(`goal-${goal.id}-win`));

    expect(await screen.findByText(i18n.t('goals.milestone', { count: 1 }))).toBeOnTheScreen();
    expect(screen.getByTestId(`goal-${goal.id}-done`)).toBeOnTheScreen();
    expect(Haptics.notificationAsync).toHaveBeenCalled();
  });

  it('asks for a daily amount, then shows the money kept from strong days', async () => {
    const session = await render();
    await fireEvent.changeText(await screen.findByTestId('money-per-day'), '1,500');
    await fireEvent.press(screen.getByTestId('money-save'));
    expect(session.updateSettings).toHaveBeenCalledWith({ moneyPerDay: 1500 });
  });

  it('shows money kept when an amount is set (10 strong days × Rs 1,500)', async () => {
    await render({ moneyPerDay: 1500 });
    expect(await screen.findByTestId('money-saved')).toHaveTextContent(
      i18n.t('goals.amount', { amount: '15,000' }),
    );
  });

  it('keeps the help button on screen', async () => {
    await render();
    expect(await screen.findByTestId('help-button')).toBeOnTheScreen();
  });
});
