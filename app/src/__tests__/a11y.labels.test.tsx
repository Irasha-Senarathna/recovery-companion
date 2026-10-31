import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import { AccessibilityInfo, StyleSheet } from 'react-native';
import { loadDemoData } from '../dev/demoData';
import { MIN_TAP } from '../theme';
import type { Database } from '../storage/types';
import { createTestDb } from '../test-utils/db';
import { fakeSession, layoutWithSession } from '../test-utils/session';
import { listRoutes, routeComponent, SESSION_FOR_ROUTE, urlFor } from '../test-utils/routes';

type HostNode = {
  type: string;
  props: Record<string, unknown>;
  children: (HostNode | string)[] | null;
};

type Insets = { top?: number; bottom?: number; left?: number; right?: number };

/** Host elements a finger or a screen reader can act on. */
function isInteractive(node: HostNode): boolean {
  const { props } = node;
  return (
    node.type === 'TextInput' ||
    node.type === 'RCTSwitch' ||
    typeof props.onClick === 'function' ||
    typeof props.onPress === 'function'
  );
}

/** Extra touch area from hitSlop, on one axis. */
function slop(hitSlop: unknown, a: keyof Insets, b: keyof Insets): number {
  if (typeof hitSlop === 'number') return hitSlop * 2;
  const insets = (hitSlop ?? {}) as Insets;
  return (insets[a] ?? 0) + (insets[b] ?? 0);
}

/** What is wrong with one interactive element, in words. */
function problems(node: HostNode): string[] {
  const { props } = node;
  const style = (StyleSheet.flatten(props.style as never) ?? {}) as Record<string, unknown>;
  const found: string[] = [];

  if (!props.accessibilityLabel && !props['aria-label']) found.push('no accessibility label');
  // A text field is announced as one by the platform; everything else names its role.
  if (node.type !== 'TextInput' && !props.accessibilityRole && !props.role) found.push('no role');

  // The native switch sizes itself (48 dp on Android); its row has MIN_TAP.
  if (node.type !== 'RCTSwitch') {
    const height = Math.max(Number(style.minHeight ?? 0), Number(style.height ?? 0));
    if (height + slop(props.hitSlop, 'top', 'bottom') < MIN_TAP) {
      found.push(`tap target ${height} dp tall`);
    }
    const width = style.width ?? style.minWidth;
    if (typeof width === 'number' && width + slop(props.hitSlop, 'left', 'right') < MIN_TAP) {
      found.push(`tap target ${width} dp wide`);
    }
  }
  return found;
}

function scan(node: HostNode | string, found: string[] = []): string[] {
  if (typeof node === 'string') return found;
  if (isInteractive(node)) {
    const name = String(node.props.testID ?? node.props.accessibilityLabel ?? node.type);
    for (const problem of problems(node)) found.push(`${name}: ${problem}`);
  }
  for (const child of node.children ?? []) scan(child, found);
  return found;
}

const countInteractive = (node: HostNode | string): number =>
  typeof node === 'string'
    ? 0
    : (isInteractive(node) ? 1 : 0) +
      (node.children ?? []).reduce((sum, child) => sum + countInteractive(child), 0);

let db: Database;

beforeEach(async () => {
  db = await createTestDb();
  jest.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);
});

afterEach(() => jest.restoreAllMocks());

async function renderRoute(route: string) {
  const session = fakeSession({ db, ...SESSION_FOR_ROUTE[route] });
  await renderRouter(
    { _layout: layoutWithSession(session), [route]: routeComponent(route) },
    { initialUrl: urlFor(route) },
  );
  await screen.findByTestId('help-button');
  return screen.root as unknown as HostNode;
}

describe('every interactive element has a label, a role and a 48 dp tap target', () => {
  const routes = listRoutes();

  it.each(routes)('/%s, with no data yet', async (route) => {
    const root = await renderRoute(route);
    expect(countInteractive(root)).toBeGreaterThan(0);
    expect(scan(root)).toEqual([]);
  });

  it.each(routes)('/%s, with 30 days of demo data', async (route) => {
    await loadDemoData(db);
    const root = await renderRoute(route);
    expect(scan(root)).toEqual([]);
  });
});

/** Taps through a flow, scanning each step it reaches. Missing buttons are skipped. */
const FLOWS: Record<string, string[]> = {
  sos: ['exercise-box-breathing', 'exercise-finish', 'reason-next', 'sos-okay'],
  slip: ['slip-save', 'slip-continue', 'slip-skip', 'slip-skip', 'slip-skip'],
  onboarding: ['onboarding-next', 'disclaimer-agree', 'onboarding-next'],
  checkin: ['checkin-save'],
};

describe('later steps of multi-step flows', () => {
  it.each(Object.entries(FLOWS))('/%s', async (route, steps) => {
    const found = scan(await renderRoute(route));
    let pressed = 0;
    for (const testID of steps) {
      const button = screen.queryByTestId(testID);
      if (!button) continue;
      await fireEvent.press(button);
      pressed++;
      scan(screen.root as unknown as HostNode, found);
    }
    expect(pressed).toBeGreaterThan(steps.length / 2);
    expect([...new Set(found)]).toEqual([]);
  });
});

describe('the scanner itself', () => {
  const node = (props: Record<string, unknown>, type = 'View'): HostNode => ({
    type,
    props: { onClick: () => {}, ...props },
    children: null,
  });

  it('flags a button without a label, a role or enough height', () => {
    expect(problems(node({ style: { minHeight: 30 } }))).toEqual([
      'no accessibility label',
      'no role',
      'tap target 30 dp tall',
    ]);
  });

  it('counts hitSlop towards the tap target', () => {
    const ok = node({
      accessibilityLabel: 'x',
      accessibilityRole: 'button',
      style: { minHeight: 40, minWidth: 40 },
      hitSlop: 4,
    });
    expect(problems(ok)).toEqual([]);
  });

  it('accepts a labelled text field without a role', () => {
    const input = node({ accessibilityLabel: 'Name', style: { minHeight: 56 } }, 'TextInput');
    expect(problems(input)).toEqual([]);
  });
});
