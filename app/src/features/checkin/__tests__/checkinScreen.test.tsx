import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import CheckInRoute from '../../../app/checkin';
import HelpRoute from '../../../app/help';
import HomeRoute from '../../../app/index';
import SosRoute from '../../../app/sos';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { getCheckIn, localDay, saveCheckIn } from '../checkinRepo';
import { MEASURES } from '../tags';

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
});

function renderCheckIn(initialUrl = '/checkin') {
  return renderRouter(
    {
      _layout: layoutWithSession(fakeSession({ db })),
      index: HomeRoute,
      checkin: CheckInRoute,
      sos: SosRoute,
      help: HelpRoute,
    },
    { initialUrl },
  );
}

async function answer(levels: Record<string, number>) {
  for (const [measure, level] of Object.entries(levels)) {
    await fireEvent.press(await screen.findByTestId(`scale-${measure}-${level}`));
  }
}

describe('daily check-in', () => {
  it('opens from the home screen', async () => {
    await renderCheckIn('/');
    await fireEvent.press(await screen.findByTestId('open-checkin'));
    expect(await screen.findByTestId('scale-mood')).toBeOnTheScreen();
  });

  it('shows four labelled, adjustable scales', async () => {
    await renderCheckIn();
    for (const measure of MEASURES) {
      const scale = await screen.findByTestId(`scale-${measure}`);
      expect(scale.props.accessibilityRole).toBe('adjustable');
      expect(scale.props.accessibilityLabel).toBeTruthy();
    }
  });

  it('saves the four answers and tags with one tap', async () => {
    await renderCheckIn();
    const save = await screen.findByTestId('checkin-save');
    expect(save.props.accessibilityState.disabled).toBe(true);

    await answer({ mood: 3, sleep: 1, stress: 2, craving: 0 });
    await fireEvent.press(screen.getByTestId('tag-tired'));
    await fireEvent.press(screen.getByTestId('checkin-save'));

    expect(await screen.findByTestId('checkin-saved')).toBeOnTheScreen();
    expect(await getCheckIn(db, localDay())).toMatchObject({
      mood: 3,
      sleep: 1,
      stress: 2,
      craving: 0,
      tags: ['tired'],
    });
  });

  it('tapping a tag again removes it', async () => {
    await renderCheckIn();
    await answer({ mood: 2, sleep: 2, stress: 2, craving: 2 });
    await fireEvent.press(await screen.findByTestId('tag-bored'));
    await fireEvent.press(screen.getByTestId('tag-bored'));
    await fireEvent.press(screen.getByTestId('checkin-save'));
    await screen.findByTestId('checkin-saved');
    expect((await getCheckIn(db, localDay()))?.tags).toEqual([]);
  });

  it('screen-reader users can adjust a scale with swipe actions', async () => {
    await renderCheckIn();
    const scale = await screen.findByTestId('scale-stress');
    await fireEvent(scale, 'accessibilityAction', { nativeEvent: { actionName: 'increment' } });
    await fireEvent(screen.getByTestId('scale-stress'), 'accessibilityAction', {
      nativeEvent: { actionName: 'increment' },
    });
    expect(screen.getByTestId('scale-stress').props.accessibilityValue).toMatchObject({ now: 3 });
  });

  it("opens with today's answers so they can be changed", async () => {
    await saveCheckIn(db, { mood: 4, sleep: 3, stress: 1, craving: 0, tags: ['payday'] });
    await renderCheckIn();
    expect(await screen.findByTestId('scale-mood')).toHaveProp(
      'accessibilityValue',
      expect.objectContaining({ now: 4 }),
    );
    expect(screen.getByTestId('tag-payday').props.accessibilityState.selected).toBe(true);
  });

  it('a strong craving offers SOS', async () => {
    await renderCheckIn();
    await answer({ mood: 2, sleep: 2, stress: 2, craving: 3 });
    await fireEvent.press(screen.getByTestId('checkin-save'));
    await fireEvent.press(await screen.findByTestId('checkin-open-sos'));
    expect(await screen.findByTestId('sos-auto-pick')).toBeOnTheScreen();
  });

  it('a very low mood offers help, without alarm when things are okay', async () => {
    await renderCheckIn();
    await answer({ mood: 0, sleep: 2, stress: 2, craving: 0 });
    await fireEvent.press(screen.getByTestId('checkin-save'));
    expect(await screen.findByTestId('checkin-get-help')).toBeOnTheScreen();
    expect(screen.queryByTestId('checkin-open-sos')).toBeNull();
  });

  it('the home screen shows when today is done', async () => {
    await saveCheckIn(db, { mood: 2, sleep: 2, stress: 2, craving: 2, tags: [] });
    await renderCheckIn('/');
    expect(await screen.findByTestId('checkin-done-today')).toBeOnTheScreen();
  });
});

describe('daily check-in: hard days', () => {
  it('low mood with a strong craving offers people first, then SOS', async () => {
    await renderCheckIn();
    await answer({ mood: 1, sleep: 2, stress: 2, craving: 4 });
    await fireEvent.press(screen.getByTestId('checkin-save'));
    await screen.findByTestId('checkin-get-help');
    const cards = screen.getAllByTestId(/^checkin-(get-help|open-sos)$/);
    expect(cards.map((node) => node.props.testID)).toEqual([
      'checkin-get-help',
      'checkin-open-sos',
    ]);
  });

  it('each scale tells screen-reader users how to change it', async () => {
    await renderCheckIn();
    await fireEvent.press(await screen.findByTestId('scale-craving-4'));
    expect(screen.getByTestId('scale-craving').props.accessibilityHint).toBeTruthy();
  });
});
