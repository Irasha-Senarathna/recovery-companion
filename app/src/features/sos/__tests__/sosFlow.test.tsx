import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, Linking } from 'react-native';
import HelpRoute from '../../../app/help';
import HomeRoute from '../../../app/index';
import SosRoute from '../../../app/sos';
import { DEFAULT_SETTINGS } from '../../../storage/settings';
import type { Database } from '../../../storage/types';
import { createTestDb } from '../../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { addText } from '../../vault/vaultRepo';
import { getExercise } from '../exercises';
import { listSessions } from '../sosRepo';

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(false);
  jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(false);
});

afterEach(() => jest.restoreAllMocks());

function renderSos(settings: Partial<typeof DEFAULT_SETTINGS> = {}, initialUrl = '/sos') {
  const session = fakeSession({
    db,
    settings: { ...DEFAULT_SETTINGS, nickname: 'Sky', onboarded: true, ...settings },
  });
  return renderRouter(
    { _layout: layoutWithSession(session), index: HomeRoute, sos: SosRoute, help: HelpRoute },
    { initialUrl },
  );
}

async function runExercise(id = 'box-breathing') {
  await fireEvent.press(await screen.findByTestId(`exercise-${id}`));
  expect(await screen.findByTestId('exercise-step-text')).toBeOnTheScreen();
  await fireEvent.press(screen.getByTestId('exercise-finish'));
}

describe('Craving SOS', () => {
  it('the home screen has a large, labelled SOS button that opens the flow', async () => {
    await renderSos({}, '/');
    const button = await screen.findByTestId('sos-button');
    expect(button.props.accessibilityLabel).toBeTruthy();
    const style = Object.assign({}, ...[button.props.style].flat(3).filter(Boolean));
    expect(style.minHeight).toBeGreaterThanOrEqual(64);
    await fireEvent.press(button);
    expect(await screen.findByTestId('sos-auto-pick')).toBeOnTheScreen();
  });

  it('keeps the help button visible on every step', async () => {
    await renderSos();
    expect(await screen.findByTestId('help-button')).toBeOnTheScreen();
    await fireEvent.press(await screen.findByTestId('exercise-box-breathing'));
    expect(screen.getByTestId('help-button')).toBeOnTheScreen();
  });

  it('walks through exercise → reason → options → outcome and saves it', async () => {
    await addText(db, 'Walking my daughter to school', 1);
    await renderSos();

    await runExercise('box-breathing');
    expect(await screen.findByText('Walking my daughter to school')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('reason-next'));

    await fireEvent.press(await screen.findByTestId('sos-okay'));
    await fireEvent.press(await screen.findByTestId('outcome-passed'));

    expect(await screen.findByTestId('sos-done')).toBeOnTheScreen();
    const [saved] = await listSessions(db);
    expect(saved).toMatchObject({ exerciseId: 'box-breathing', outcome: 'passed' });
    expect(saved.endedAt).not.toBeNull();
  });

  it('steps through an exercise one instruction at a time', async () => {
    await renderSos();
    await fireEvent.press(await screen.findByTestId('exercise-five-senses'));
    const first = (await screen.findByTestId('exercise-step-text')).props.children;
    await fireEvent.press(screen.getByTestId('exercise-next'));
    expect(screen.getByTestId('exercise-step-text').props.children).not.toBe(first);
  });

  it('auto-picks an exercise', async () => {
    await renderSos();
    await fireEvent.press(await screen.findByTestId('sos-auto-pick'));
    expect(await screen.findByTestId('exercise-step-text')).toBeOnTheScreen();
  });

  it('skips the reason step when the vault is empty', async () => {
    await renderSos();
    await runExercise();
    expect(await screen.findByTestId('sos-okay')).toBeOnTheScreen();
  });

  it('calls the support person when one is set, dialling every digit', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
    await renderSos({ supportName: 'Amma', supportPhone: '077 - 123 4567' });
    await runExercise();
    await fireEvent.press(await screen.findByTestId('sos-call-support'));
    expect(openURL).toHaveBeenCalledWith('tel:0771234567');
    expect(screen.getByText('077 - 123 4567')).toBeOnTheScreen();
  });

  it('shows the number if the call cannot be started', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no dialer'));
    await renderSos({ supportName: 'Amma', supportPhone: '0771234567' });
    await runExercise();
    await fireEvent.press(await screen.findByTestId('sos-call-support'));
    expect(await screen.findByText(/could not be started/i)).toBeOnTheScreen();
  });

  it('offers urgent help before and during an exercise, not only after it', async () => {
    await renderSos();
    expect(await screen.findByTestId('sos-crisis-help')).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('exercise-box-breathing'));
    await fireEvent.press(await screen.findByTestId('sos-crisis-help'));
    expect(await screen.findByTestId('crisis-message')).toBeOnTheScreen();
  });

  it('offers help next to a saved reason that mentions a crisis', async () => {
    await addText(db, "I don't want to end up like my friend who overdosed", 1);
    await renderSos();
    await runExercise();
    await screen.findByTestId('reason-next');
    expect(screen.getByTestId('sos-crisis-help')).toBeOnTheScreen();
  });

  it('can show a different reason', async () => {
    await addText(db, 'First reason', 1);
    await addText(db, 'Second reason', 2);
    await renderSos();
    await runExercise();
    const first = (await screen.findByText(/^(First|Second) reason$/)).props.children;
    await fireEvent.press(screen.getByTestId('reason-another'));
    expect(
      await screen.findByText(first === 'First reason' ? 'Second reason' : 'First reason'),
    ).toBeOnTheScreen();
  });

  it('can pause an exercise so it does not move on by itself', async () => {
    jest.useFakeTimers();
    try {
      await renderSos();
      await fireEvent.press(await screen.findByTestId('exercise-five-senses'));
      const first = screen.getByTestId('exercise-step-text').props.children;
      await fireEvent.press(screen.getByTestId('exercise-pause'));
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByTestId('exercise-step-text').props.children).toBe(first);
    } finally {
      jest.useRealTimers();
    }
  });

  it('does not auto-advance while a screen reader is on', async () => {
    jest.spyOn(AccessibilityInfo, 'isScreenReaderEnabled').mockResolvedValue(true);
    jest.useFakeTimers();
    try {
      await renderSos();
      await fireEvent.press(await screen.findByTestId('exercise-five-senses'));
      const first = screen.getByTestId('exercise-step-text').props.children;
      await act(async () => {
        jest.advanceTimersByTime(60_000);
      });
      expect(screen.getByTestId('exercise-step-text').props.children).toBe(first);
    } finally {
      jest.useRealTimers();
    }
  });

  it('offers to add a support person when none is set', async () => {
    await renderSos();
    await runExercise();
    expect(await screen.findByTestId('sos-add-support')).toBeOnTheScreen();
    expect(screen.queryByTestId('sos-call-support')).toBeNull();
  });

  it('"Get help" opens help without ending the session', async () => {
    await renderSos();
    await runExercise();
    await fireEvent.press(await screen.findByTestId('sos-get-help'));
    expect(await screen.findByTestId('help-screen')).toBeOnTheScreen();
    expect((await listSessions(db))[0].outcome).toBeNull();
  });

  it('a craving that has not passed yet gets support, not judgement', async () => {
    await renderSos();
    await runExercise();
    await fireEvent.press(await screen.findByTestId('sos-okay'));
    await fireEvent.press(await screen.findByTestId('outcome-not-yet'));

    expect(await screen.findByTestId('sos-try-another')).toBeOnTheScreen();
    expect(screen.getByTestId('sos-get-help')).toBeOnTheScreen();
    expect((await listSessions(db))[0].outcome).toBe('not_yet');
    expect(screen.queryByText(/fail|weak|should have/i)).toBeNull();
  });

  it('shows the breathing wave, or a still version when reduce-motion is on', async () => {
    await renderSos();
    await fireEvent.press(await screen.findByTestId('exercise-slow-breathing'));
    expect(await screen.findByTestId('breathing-wave')).toBeOnTheScreen();

    jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
    await renderSos();
    await fireEvent.press(await screen.findByTestId('exercise-slow-breathing'));
    expect(await screen.findByTestId('breathing-static')).toBeOnTheScreen();
  });

  it('moves to the next step on its own when the step time is up', async () => {
    jest.useFakeTimers();
    try {
      await renderSos();
      await fireEvent.press(await screen.findByTestId('exercise-five-senses'));
      const first = screen.getByTestId('exercise-step-text').props.children;
      const seconds = getExercise('five-senses')!.steps[0].seconds;
      await act(async () => {
        jest.advanceTimersByTime(seconds * 1000);
      });
      expect(screen.getByTestId('exercise-step-text').props.children).not.toBe(first);
    } finally {
      jest.useRealTimers();
    }
  });
});
