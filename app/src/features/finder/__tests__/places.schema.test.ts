import realFile from '../../../../../content/support_places.json';
import { verificationStatus } from '../../help/helplines';
import {
  filterPlaces,
  listAreas,
  loadPlaces,
  parsePlaces,
  PLACE_TYPES,
  safeWebsite,
  type SupportPlace,
} from '../places';

const place = (overrides: Partial<SupportPlace> = {}): SupportPlace => ({
  id: 'demo-a',
  demo: true,
  type: 'counselling',
  name: { en: 'Demo Counselling', si: '', ta: '' },
  area: { en: 'Colombo', si: '', ta: '' },
  hours: { en: 'Mon–Fri', si: '', ta: '' },
  phone: null,
  website: null,
  source_url: '',
  last_verified: '2026-09-01',
  ...overrides,
});

const isLocalized = (v: unknown) =>
  typeof v === 'object' &&
  v !== null &&
  ['en', 'si', 'ta'].every((lang) => typeof (v as Record<string, unknown>)[lang] === 'string');

describe('content/support_places.json', () => {
  const entries = realFile.places as Record<string, unknown>[];

  it('has places, and the app keeps every one of them', () => {
    expect(entries.length).toBeGreaterThan(0);
    expect(loadPlaces()).toHaveLength(entries.length);
  });

  it('uses unique ids', () => {
    const ids = entries.map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it.each(entries.map((e) => [e.id, e]))('%s has every field with the right type', (_, e) => {
    const entry = e as Record<string, unknown>;
    expect(typeof entry.id).toBe('string');
    expect(typeof entry.demo).toBe('boolean');
    expect(PLACE_TYPES).toContain(entry.type);
    expect(isLocalized(entry.name)).toBe(true);
    expect(isLocalized(entry.area)).toBe(true);
    expect((entry.name as { en: string }).en.trim()).not.toBe('');
    expect((entry.area as { en: string }).en.trim()).not.toBe('');
    expect(isLocalized(entry.hours)).toBe(true);
    expect(typeof entry.source_url).toBe('string');
    expect(['string', 'object']).toContain(typeof entry.phone);
    expect(['string', 'object']).toContain(typeof entry.website);
  });

  it.each(entries.map((e) => [e.id, e]))('%s has a real, past check date', (_, e) => {
    const date = (e as { last_verified: string }).last_verified;
    expect(verificationStatus(date, new Date())).not.toBe('unverified');
  });

  it('demo entries have no contact details, so nothing made-up can be dialled', () => {
    const demos = entries.filter((e) => e.demo);
    demos.forEach((e) => {
      expect(e.phone).toBeNull();
      expect(e.website).toBeNull();
    });
  });

  it('real entries cite an https source and a way to get in touch', () => {
    const real = entries.filter((e) => !e.demo);
    real.forEach((e) => {
      expect(safeWebsite(e.source_url as string)).not.toBeNull();
      expect(e.phone || e.website).toBeTruthy();
    });
  });
});

describe('parsePlaces', () => {
  it('keeps well-formed entries', () => {
    expect(parsePlaces({ places: [place()] })).toEqual([place()]);
  });

  it.each([null, 'text', {}, { places: 'x' }, { places: [{ id: 1 }] }])(
    'returns no places for malformed content (%p)',
    (raw) => {
      expect(parsePlaces(raw)).toEqual([]);
    },
  );

  it('drops entries with an unknown type, no name or no area', () => {
    const raw = {
      places: [
        { ...place({ id: 'a' }), type: 'pharmacy' },
        place({ id: 'b', name: { en: ' ', si: '', ta: '' } }),
        place({ id: 'c', area: { en: '', si: '', ta: '' } }),
        place({ id: 'd' }),
      ],
    };
    expect(parsePlaces(raw).map((p) => p.id)).toEqual(['d']);
  });

  it('keeps only the first entry for a repeated id', () => {
    const first = place({ hours: { en: 'first', si: '', ta: '' } });
    const raw = { places: [first, place({ hours: { en: 'second', si: '', ta: '' } })] };
    expect(parsePlaces(raw)).toEqual([first]);
  });

  it('treats an entry as demo unless it says demo: false', () => {
    const { demo: _demo, ...noFlag } = place({ phone: '011 000 0000' });
    expect(parsePlaces({ places: [noFlag] })[0]).toMatchObject({ demo: true, phone: null });
  });

  it('never keeps contact details on a demo entry', () => {
    const raw = { places: [place({ phone: '011 000 0000', website: 'https://example.org' })] };
    expect(parsePlaces(raw)[0]).toMatchObject({ phone: null, website: null });
  });

  it('keeps contact details on a real entry, but only https websites', () => {
    const real = { demo: false, phone: '011 000 0000', source_url: 'https://example.org' };
    const raw = {
      places: [
        place({ id: 'a', ...real, website: 'https://example.org/a' }),
        place({ id: 'b', ...real, website: 'javascript:alert(1)' }),
      ],
    };
    const [a, b] = parsePlaces(raw);
    expect(a).toMatchObject({ phone: '011 000 0000', website: 'https://example.org/a' });
    expect(b.website).toBeNull();
  });

  it('drops contact details from a real entry with no https source', () => {
    const raw = { places: [place({ demo: false, phone: '011 000 0000', source_url: '' })] };
    expect(parsePlaces(raw)[0]).toMatchObject({ demo: false, phone: null, website: null });
  });

  it('fills missing translations with empty text, never a guess', () => {
    const raw = {
      places: [{ ...place(), name: { en: 'Demo' }, area: { en: 'Kandy' }, hours: 'Daily' }],
    };
    expect(parsePlaces(raw)[0]).toMatchObject({
      name: { en: 'Demo', si: '', ta: '' },
      area: { en: 'Kandy', si: '', ta: '' },
      hours: { en: 'Daily', si: '', ta: '' },
    });
  });
});

describe('safeWebsite', () => {
  it.each([
    ['https://nddcb.gov.lk/', 'https://nddcb.gov.lk/'],
    ['http://example.org', null],
    ['javascript:alert(1)', null],
    ['', null],
    ['  https://example.org  ', 'https://example.org'],
  ])('%p → %p', (url, expected) => {
    expect(safeWebsite(url)).toBe(expected);
  });
});

describe('filtering', () => {
  const places = [
    place({ id: 'a', type: 'counselling', area: { en: 'Colombo', si: '', ta: '' } }),
    place({ id: 'b', type: 'support_group', area: { en: 'Kandy', si: '', ta: '' } }),
    place({ id: 'c', type: 'treatment_centre', area: { en: 'Colombo', si: '', ta: '' } }),
  ];

  it('lists each area once, in order', () => {
    expect(listAreas(places)).toEqual(['Colombo', 'Kandy']);
  });

  it('filters by type, by area, or both', () => {
    const ids = (f: Parameters<typeof filterPlaces>[1]) => filterPlaces(places, f).map((p) => p.id);
    expect(ids({ type: null, area: null })).toEqual(['a', 'b', 'c']);
    expect(ids({ type: 'counselling', area: null })).toEqual(['a']);
    expect(ids({ type: null, area: 'Colombo' })).toEqual(['a', 'c']);
    expect(ids({ type: 'treatment_centre', area: 'Colombo' })).toEqual(['c']);
    expect(ids({ type: 'support_group', area: 'Colombo' })).toEqual([]);
  });
});
