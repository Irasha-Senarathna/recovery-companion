import fs from 'fs';
import path from 'path';
import { renderRouter, screen } from 'expo-router/testing-library';

const APP_DIR = path.join(__dirname, '..', 'app');

/** Every route file in src/app (layouts excluded) mapped to its URL. */
function listRoutes(): string[] {
  return fs
    .readdirSync(APP_DIR)
    .filter((file) => file.endsWith('.tsx') && !file.startsWith('_'))
    .map((file) => file.replace(/\.tsx$/, ''))
    .map((name) => (name === 'index' ? '/' : `/${name}`));
}

describe('every screen', () => {
  const routes = listRoutes();

  it('has routes to check', () => {
    expect(routes).toEqual(expect.arrayContaining(['/', '/help', '/settings']));
  });

  it.each(routes)('%s shows the help button (safety rule 2)', async (route) => {
    await renderRouter(APP_DIR, { initialUrl: route });
    const button = await screen.findByTestId('help-button');
    expect(button).toBeOnTheScreen();
    expect(button.props.accessibilityRole).toBe('button');
    expect(button.props.accessibilityLabel).toBeTruthy();
  });
});
