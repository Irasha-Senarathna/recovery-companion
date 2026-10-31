import fs from 'fs';
import path from 'path';
import type { Session } from '../features/session/SessionProvider';

export const APP_DIR = path.join(__dirname, '..', 'app');

/** Every route file in src/app (layouts excluded), by route name. */
export function listRoutes(): string[] {
  return fs
    .readdirSync(APP_DIR)
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
    .map((file) => file.replace(/\.tsx$/, ''));
}

/** The session state in which each route is reachable. */
export const SESSION_FOR_ROUTE: Record<string, Partial<Session>> = {
  index: { status: 'unlocked' },
  settings: { status: 'unlocked' },
  about: { status: 'unlocked' },
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
  circle: { status: 'unlocked' },
  'circle-invite': { status: 'unlocked' },
  supporter: { status: 'unlocked' },
  slip: { status: 'unlocked' },
  goals: { status: 'unlocked' },
  finder: { status: 'unlocked' },
  'first-visit': { status: 'unlocked' },
  coach: { status: 'unlocked' },
};

/** The default export of a route file. */
export function routeComponent(route: string): () => React.JSX.Element {
  return jest.requireActual(path.join(APP_DIR, `${route}.tsx`)).default;
}

export const urlFor = (route: string) => (route === 'index' ? '/' : `/${route}`);
