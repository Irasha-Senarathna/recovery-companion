import { fireEvent, render, screen } from '@testing-library/react-native';
import { renderRouter } from 'expo-router/testing-library';
import CircleRoute from '../../app/circle';
import GoalsRoute from '../../app/goals';
import ProgressRoute from '../../app/progress';
import TriggersRoute from '../../app/triggers';
import VaultRoute from '../../app/vault';
import { CircleClientContext } from '../../features/circle/client';
import { HelplineList } from '../../features/help/HelplineList';
import type { Database } from '../../storage/types';
import { createFakeCircle } from '../../test-utils/fakeCircleClient';
import { createTestDb } from '../../test-utils/db';
import { fakeSession, layoutWithSession } from '../../test-utils/session';
import { EmptyState } from '../EmptyState';

describe('EmptyState', () => {
  it('shows a message, and a title when given', async () => {
    await render(<EmptyState testID="e" title="Nothing here yet" message="Add one below." />);
    expect(screen.getByTestId('e')).toBeOnTheScreen();
    expect(screen.getByText('Nothing here yet')).toBeOnTheScreen();
    expect(screen.getByText('Add one below.')).toBeOnTheScreen();
  });

  it('offers one next step when given', async () => {
    const onPress = jest.fn();
    await render(
      <EmptyState
        testID="e"
        message="No matches."
        action={{ label: 'Show all', onPress, testID: 'e-action' }}
      />,
    );
    await fireEvent.press(screen.getByTestId('e-action'));
    expect(onPress).toHaveBeenCalled();
    expect(screen.getByTestId('e-action').props.accessibilityLabel).toBe('Show all');
  });

  it('reads the title as a heading', async () => {
    await render(<EmptyState testID="e" title="Nothing here yet" message="m" />);
    expect(screen.getByRole('header', { name: 'Nothing here yet' })).toBeOnTheScreen();
  });
});

describe('each list screen has an empty state', () => {
  let db: Database;

  beforeEach(async () => {
    db = await createTestDb();
  });

  const renderRoute = (name: string, Route: () => React.JSX.Element | null) =>
    renderRouter(
      { _layout: layoutWithSession(fakeSession({ db })), [name]: Route },
      { initialUrl: `/${name}` },
    );

  it('reasons vault', async () => {
    await renderRoute('vault', VaultRoute);
    expect(await screen.findByTestId('vault-empty')).toBeOnTheScreen();
  });

  it('goals', async () => {
    await renderRoute('goals', GoalsRoute);
    expect(await screen.findByTestId('goals-empty')).toBeOnTheScreen();
  });

  it('progress: no cravings got through yet', async () => {
    await renderRoute('progress', ProgressRoute);
    expect(await screen.findByTestId('sos-stats-empty')).toBeOnTheScreen();
  });

  it('trigger map: no patterns yet', async () => {
    await renderRoute('triggers', TriggersRoute);
    expect(await screen.findByTestId('triggers-empty')).toBeOnTheScreen();
  });

  it('support circle: nobody invited yet', async () => {
    const { client } = createFakeCircle();
    const Circle = () => (
      <CircleClientContext.Provider value={client}>
        <CircleRoute />
      </CircleClientContext.Provider>
    );
    await renderRoute('circle', Circle);
    await fireEvent.press(await screen.findByTestId('circle-turn-on'));
    expect(await screen.findByTestId('circle-empty')).toBeOnTheScreen();
  });

  it('help contacts not set up', async () => {
    await render(<HelplineList entries={[]} />);
    expect(screen.getByTestId('helplines-empty')).toBeOnTheScreen();
  });
});
