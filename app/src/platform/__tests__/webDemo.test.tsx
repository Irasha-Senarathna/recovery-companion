import { render, screen } from '@testing-library/react-native';
import '../../i18n';
import { isWebDemo as isWebDemoWeb } from '../isWebDemo.web';
import { WebDemoBanner } from '../WebDemoBanner';

jest.mock('../isWebDemo', () => ({ isWebDemo: jest.fn(() => false) }));
const mockedIsWebDemo = jest.requireMock('../isWebDemo').isWebDemo as jest.Mock;

describe('platform adapters', () => {
  it('the web build is a demo, the native build is not', () => {
    expect(isWebDemoWeb()).toBe(true);
    expect(jest.requireActual('../isWebDemo').isWebDemo()).toBe(false);
  });
});

describe('WebDemoBanner', () => {
  it('shows a "not for real data" banner in the web demo', async () => {
    mockedIsWebDemo.mockReturnValue(true);
    await render(<WebDemoBanner />);
    expect(screen.getByTestId('web-demo-banner')).toBeOnTheScreen();
    expect(screen.getByText(/not for real data/i)).toBeOnTheScreen();
  });

  it('renders nothing on the phone', async () => {
    mockedIsWebDemo.mockReturnValue(false);
    await render(<WebDemoBanner />);
    expect(screen.queryByTestId('web-demo-banner')).toBeNull();
  });
});
