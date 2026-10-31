import { renderRouter, screen } from 'expo-router/testing-library';
import { fakeSession, layoutWithSession } from '../test-utils/session';
import { listRoutes, routeComponent, SESSION_FOR_ROUTE, urlFor } from '../test-utils/routes';

describe('every screen', () => {
  const routes = listRoutes();

  it('has routes to check, each with a known session state', () => {
    expect(routes).toEqual(expect.arrayContaining(Object.keys(SESSION_FOR_ROUTE)));
    expect(Object.keys(SESSION_FOR_ROUTE)).toEqual(expect.arrayContaining(routes));
  });

  it.each(routes)('/%s shows the help button (safety rule 2)', async (route) => {
    const session = fakeSession(SESSION_FOR_ROUTE[route]);
    await renderRouter(
      { _layout: layoutWithSession(session), [route]: routeComponent(route) },
      { initialUrl: urlFor(route) },
    );
    const button = await screen.findByTestId('help-button');
    expect(button).toBeOnTheScreen();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBeTruthy();
  });
});
