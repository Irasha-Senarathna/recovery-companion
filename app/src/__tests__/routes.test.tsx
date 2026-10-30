import fs from 'fs';
import path from 'path';
import { renderRouter, screen } from 'expo-router/testing-library';
import type { Session } from '../features/session/SessionProvider';
import { fakeSession, layoutWithSession } from '../test-utils/session';

const APP_DIR = path.join(__dirname, '..', 'app');

/** Every route file in src/app (layouts excluded), by route name. */
function listRoutes(): string[] {
  return fs
    .readdirSync(APP_DIR)
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
    .map((file) => file.replace(/\.tsx$/, ''));
}

/** The session state in which each route is reachable. */
const SESSION_FOR_ROUTE: Record<string, Partial<Session>> = {
  index: { status: 'unlocked' },
  settings: { status: 'unlocked' },
  help: { status: 'locked' },
  lock: { status: 'locked' },
  hidden: { status: 'locked', hidden: true },
  onboarding: { status: 'onboarding' },
  problem: { status: 'error' },
  loading: { status: 'loading' },
  sos: { status: 'unlocked' },
  vault: { status: 'unlocked' },
  progress: { status: 'unlocked' },
  checkin: { status: 'unlocked' },
  triggers: { status: 'unlocked' },
  'coping-plan': { status: 'unlocked' },
};

describe('every screen', () => {
  const routes = listRoutes();

  it('has routes to check, each with a known session state', () => {
    expect(routes).toEqual(expect.arrayContaining(Object.keys(SESSION_FOR_ROUTE)));
    expect(Object.keys(SESSION_FOR_ROUTE)).toEqual(expect.arrayContaining(routes));
  });

  it.each(routes)('/%s shows the help button (safety rule 2)', async (route) => {
    const session = fakeSession(SESSION_FOR_ROUTE[route]);
    const component = jest.requireActual(path.join(APP_DIR, `${route}.tsx`)).default;
    await renderRouter(
      { _layout: layoutWithSession(session), [route]: component },
      { initialUrl: route === 'index' ? '/' : `/${route}` },
    );
    const button = await screen.findByTestId('help-button');
    expect(button).toBeOnTheScreen();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBeTruthy();
  });
});
