import { act, fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo } from 'react-native';
import { loadDemoData } from '../dev/demoData';
import { listCheckIns } from '../features/checkin/checkinRepo';
import { listGoals } from '../features/goals/goalsRepo';
import { listSlips } from '../features/slip/slipRepo';
import { listSessions } from '../features/sos/sosRepo';
import { getCopingPlan } from '../features/triggers/copingPlanRepo';
import { listItems } from '../features/vault/vaultRepo';
import type { Database } from '../storage/types';
import { createTestDb } from '../test-utils/db';
import { listRoutes, routeComponent, SESSION_FOR_ROUTE, urlFor } from '../test-utils/routes';
import { fakeSession, layoutWithSession } from '../test-utils/session';

/** The only features that need the network; everything else works in airplane mode. */
const ONLINE_ONLY = ['circle', 'circle-invite', 'supporter', 'coach'];
const OFFLINE_ROUTES = listRoutes().filter((route) => !ONLINE_ONLY.includes(route));

let db: Database;
let fetchSpy: jest.Mock;
let socketSpy: jest.Mock;
let xhrSpy: jest.Mock;
const realFetch = global.fetch;
const realWebSocket = global.WebSocket;
const realXhr = global.XMLHttpRequest;

beforeEach(async () => {
  db = await createTestDb();
  await loadDemoData(db);
  fetchSpy = jest.fn(async () => {
    throw new TypeError('Network request failed');
  });
  global.fetch = fetchSpy;
  socketSpy = jest.fn(() => {
    throw new Error('offline');
  });
  global.WebSocket = socketSpy as unknown as typeof WebSocket;
  xhrSpy = jest.fn(() => {
    throw new Error('offline');
  });
  global.XMLHttpRequest = xhrSpy as unknown as typeof XMLHttpRequest;
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(async () => {
  // Late effects (deferred loads, timers) must not reach the network either.
  await act(async () => {});
  expect(fetchSpy).not.toHaveBeenCalled();
  expect(socketSpy).not.toHaveBeenCalled();
  expect(xhrSpy).not.toHaveBeenCalled();
  global.fetch = realFetch;
  global.WebSocket = realWebSocket;
  global.XMLHttpRequest = realXhr;
  jest.restoreAllMocks();
});

/** Renders a route plus every core screen it can navigate to. */
async function open(route: string) {
  const session = fakeSession({ db, ...SESSION_FOR_ROUTE[route] });
  const routes = Object.fromEntries(OFFLINE_ROUTES.map((name) => [name, routeComponent(name)]));
  await renderRouter(
    { _layout: layoutWithSession(session), ...routes },
    { initialUrl: urlFor(route) },
  );
  await screen.findByTestId('help-button');
}

describe('airplane mode', () => {
  it('leaves only the circle and the coach needing the network', () => {
    expect(OFFLINE_ROUTES).toEqual(
      expect.arrayContaining(['index', 'sos', 'checkin', 'vault', 'goals', 'slip', 'help']),
    );
  });

  it.each(OFFLINE_ROUTES)('/%s opens without the network', async (route) => {
    await open(route);
    expect(screen.queryByTestId('storage-problem')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('saves a check-in', async () => {
    const before = (await listCheckIns(db)).length;
    await open('checkin');
    for (const measure of ['mood', 'sleep', 'stress', 'craving']) {
      await fireEvent.press(screen.getByTestId(`scale-${measure}-2`));
    }
    await fireEvent.press(screen.getByTestId('checkin-save'));
    expect(await screen.findByTestId('checkin-saved')).toBeOnTheScreen();
    expect((await listCheckIns(db)).length).toBe(before + 1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('runs a craving SOS exercise', async () => {
    const before = (await listSessions(db)).length;
    await open('sos');
    await fireEvent.press(await screen.findByTestId('exercise-box-breathing'));
    await fireEvent.press(screen.getByTestId('exercise-finish'));
    expect((await listSessions(db)).length).toBe(before + 1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('keeps a reason in the vault', async () => {
    await open('vault');
    await fireEvent.changeText(screen.getByTestId('vault-text-input'), 'My garden');
    await fireEvent.press(screen.getByTestId('vault-add-text'));
    expect(await screen.findByText('My garden')).toBeOnTheScreen();
    expect(await listItems(db)).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('adds a goal', async () => {
    await open('goals');
    await fireEvent.press(screen.getByTestId('goal-area-sleep'));
    await fireEvent.changeText(screen.getByTestId('goal-title'), 'In bed by 11');
    await fireEvent.press(screen.getByTestId('goal-add'));
    expect(await screen.findByText('In bed by 11')).toBeOnTheScreen();
    expect(await listGoals(db)).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('saves a coping plan', async () => {
    await open('coping-plan');
    await fireEvent.changeText(screen.getByTestId('plan-signs'), 'Skipping meals');
    await fireEvent.press(screen.getByTestId('plan-save'));
    expect(await screen.findByTestId('plan-saved')).toBeOnTheScreen();
    expect((await getCopingPlan(db)).signs).toBe('Skipping meals');
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('logs a slip without losing progress', async () => {
    await open('slip');
    await fireEvent.press(screen.getByTestId('slip-save'));
    expect(await screen.findByTestId('slip-counted')).toBeOnTheScreen();
    expect(await listSlips(db)).toHaveLength(1);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('shows helplines and treatment places from the phone', async () => {
    await open('finder');
    expect(screen.queryByTestId('finder-empty')).toBeNull();
    await open('help');
    expect(screen.queryByTestId('helplines-empty')).toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
