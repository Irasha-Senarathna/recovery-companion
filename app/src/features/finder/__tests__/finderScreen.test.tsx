import { act, fireEvent, renderRouter, screen, within } from 'expo-router/testing-library';
import { Linking } from 'react-native';
import FirstVisitRoute from '../../../app/first-visit';
import HelpRoute from '../../../app/help';
import i18n from '../../../i18n';
import { fakeSession, layoutWithSession } from '../../../test-utils/session';
import { loadFirstVisit } from '../firstVisit';
import { FinderScreen } from '../FinderScreen';
import type { SupportPlace } from '../places';

const today = new Date(2026, 9, 31); // 31 Oct 2026

const place = (overrides: Partial<SupportPlace>): SupportPlace => ({
  id: 'x',
  demo: false,
  type: 'counselling',
  name: { en: 'Name', si: '', ta: '' },
  area: { en: 'Colombo', si: 'කොළඹ', ta: '' },
  hours: { en: 'Mon–Fri, 9 am – 5 pm', si: 'සඳු–සිකු', ta: '' },
  phone: null,
  website: null,
  source_url: 'https://example.org',
  last_verified: '2026-10-01',
  ...overrides,
});

const PLACES: SupportPlace[] = [
  place({
    id: 'harbour',
    name: { en: 'Harbour Counselling', si: '', ta: '' },
    phone: '011 000 0000',
    website: 'https://example.org/harbour',
  }),
  place({
    id: 'hill',
    type: 'support_group',
    name: { en: 'Hill Peer Group', si: '', ta: '' },
    area: { en: 'Kandy', si: 'මහනුවර', ta: '' },
    phone: '081 000 0000',
    last_verified: '2026-01-15', // more than six months ago
  }),
  place({
    id: 'demo-centre',
    demo: true,
    type: 'treatment_centre',
    name: { en: 'Demo Recovery Centre', si: '', ta: '' },
    source_url: '',
  }),
];

let fetchSpy: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(Linking, 'openURL').mockResolvedValue(undefined);
  fetchSpy = jest.spyOn(global, 'fetch').mockRejectedValue(new Error('offline'));
});

afterEach(async () => {
  jest.restoreAllMocks();
  await act(() => i18n.changeLanguage('en'));
});

async function render(places = PLACES) {
  const Finder = () => <FinderScreen places={places} today={today} />;
  await renderRouter(
    {
      _layout: layoutWithSession(fakeSession()),
      finder: Finder,
      'first-visit': FirstVisitRoute,
      help: HelpRoute,
    },
    { initialUrl: '/finder' },
  );
}

const card = (id: string) => within(screen.getByTestId(`place-${id}`));

describe('support finder', () => {
  it('lists each place with name, type, area, hours, contact and check date', async () => {
    await render();
    const harbour = card('harbour');
    expect(harbour.getByText('Harbour Counselling')).toBeOnTheScreen();
    expect(harbour.getByText(i18n.t('finder.types.counselling'))).toBeOnTheScreen();
    expect(harbour.getByText(i18n.t('finder.area', { area: 'Colombo' }))).toBeOnTheScreen();
    expect(
      harbour.getByText(i18n.t('finder.hours', { hours: 'Mon–Fri, 9 am – 5 pm' })),
    ).toBeOnTheScreen();
    expect(harbour.getByText('011 000 0000')).toBeOnTheScreen();
    expect(
      harbour.getByText(i18n.t('help.lastVerified', { date: '2026-10-01' })),
    ).toBeOnTheScreen();
  });

  it('calls and opens the website only when the person taps', async () => {
    await render();
    expect(Linking.openURL).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('place-harbour-call'));
    expect(Linking.openURL).toHaveBeenCalledWith('tel:0110000000');
    await fireEvent.press(screen.getByTestId('place-harbour-website'));
    expect(Linking.openURL).toHaveBeenCalledWith('https://example.org/harbour');
  });

  it('says so if the phone or browser cannot be opened', async () => {
    jest.spyOn(Linking, 'openURL').mockRejectedValue(new Error('no dialer'));
    await render();
    await fireEvent.press(screen.getByTestId('place-harbour-call'));
    expect(await screen.findByText(i18n.t('finder.openFailed'))).toBeOnTheScreen();
  });

  it('filters by type', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('finder-type-support_group'));
    expect(screen.getByTestId('place-hill')).toBeOnTheScreen();
    expect(screen.queryByTestId('place-harbour')).toBeNull();
    expect(screen.queryByTestId('place-demo-centre')).toBeNull();
    await fireEvent.press(screen.getByTestId('finder-type-all'));
    expect(screen.getByTestId('place-harbour')).toBeOnTheScreen();
  });

  it('filters by area, shown in the current language', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('finder-area-Kandy'));
    expect(screen.getByTestId('place-hill')).toBeOnTheScreen();
    expect(screen.queryByTestId('place-harbour')).toBeNull();

    await act(() => i18n.changeLanguage('si'));
    expect(screen.getByTestId('finder-area-Kandy')).toHaveTextContent('මහනුවර');
  });

  it('shows opening hours in the current language, falling back to English', async () => {
    await act(() => i18n.changeLanguage('si'));
    await render();
    expect(card('harbour').getByText(i18n.t('finder.hours', { hours: 'සඳු–සිකු' }))).toBeOnTheScreen();
    await act(() => i18n.changeLanguage('ta'));
    expect(
      card('harbour').getByText(i18n.t('finder.hours', { hours: 'Mon–Fri, 9 am – 5 pm' })),
    ).toBeOnTheScreen();
  });

  it('says when nothing matches, and can clear the filters', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('finder-type-treatment_centre'));
    await fireEvent.press(screen.getByTestId('finder-area-Kandy'));
    expect(screen.getByText(i18n.t('finder.noMatch'))).toBeOnTheScreen();
    await fireEvent.press(screen.getByTestId('finder-clear'));
    expect(screen.getByTestId('place-harbour')).toBeOnTheScreen();
    expect(screen.getByTestId('place-hill')).toBeOnTheScreen();
  });

  it('marks demo entries, with no way to call a made-up place', async () => {
    await render();
    const demo = card('demo-centre');
    expect(demo.getByText(i18n.t('finder.demoBadge'))).toBeOnTheScreen();
    expect(demo.getByText(i18n.t('finder.demoNote'))).toBeOnTheScreen();
    expect(screen.queryByTestId('place-demo-centre-call')).toBeNull();
    expect(screen.queryByTestId('place-demo-centre-website')).toBeNull();
    expect(card('harbour').queryByText(i18n.t('finder.demoBadge'))).toBeNull();
    expect(screen.getByText(i18n.t('finder.demoIntro'))).toBeOnTheScreen();
  });

  it('never presents a demo entry as checked, but still shows stale warnings', async () => {
    const demos = [
      place({ id: 'fresh', demo: true, last_verified: '2026-10-01' }),
      place({ id: 'old', demo: true, last_verified: '2026-01-15' }),
    ];
    await render(demos);
    expect(card('fresh').queryByText(/2026-10-01/)).toBeNull();
    expect(card('old').getByText(i18n.t('finder.stale', { date: '2026-01-15' }))).toBeOnTheScreen();
  });

  it('warns when a place was checked more than six months ago', async () => {
    await render();
    expect(
      card('hill').getByText(i18n.t('finder.stale', { date: '2026-01-15' })),
    ).toBeOnTheScreen();
    expect(card('harbour').queryByText(i18n.t('finder.stale', { date: '2026-10-01' }))).toBeNull();
  });

  it('says when no places have been added yet', async () => {
    await render([]);
    expect(screen.getByText(i18n.t('finder.none'))).toBeOnTheScreen();
    expect(screen.queryByTestId('finder-type-all')).toBeNull();
  });

  it('works offline: everything comes from the bundled file', async () => {
    await render();
    expect(screen.getByTestId('place-harbour')).toBeOnTheScreen();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it.each(['en', 'si', 'ta'] as const)(
    'opens "What happens at your first visit?" in %s',
    async (language) => {
      await act(() => i18n.changeLanguage(language));
      await render();
      await fireEvent.press(screen.getByTestId('open-first-visit'));
      const guide = loadFirstVisit(language);
      expect(await screen.findByText(guide.title)).toBeOnTheScreen();
      expect(
        screen.getByText(guide.blocks.find((b) => b.kind === 'bullet')!.text, { exact: false }),
      ).toBeOnTheScreen();
      expect(screen.getByTestId('help-button')).toBeOnTheScreen();
    },
  );

  it('ends the first-visit guide with its own way to get help', async () => {
    await render();
    await fireEvent.press(screen.getByTestId('open-first-visit'));
    await fireEvent.press(await screen.findByTestId('first-visit-help'));
    expect(await screen.findByTestId('help-screen')).toBeOnTheScreen();
  });

  it('keeps the help button on screen', async () => {
    await render();
    expect(screen.getByTestId('help-button')).toBeOnTheScreen();
  });
});
