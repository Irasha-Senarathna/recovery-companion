import { placeStatus, type SupportPlace } from '../places';

const place = (last_verified: string | null): SupportPlace => ({
  id: 'demo-a',
  demo: true,
  type: 'counselling',
  name: { en: 'Demo Counselling', si: '', ta: '' },
  area: { en: 'Colombo', si: '', ta: '' },
  hours: { en: '', si: '', ta: '' },
  phone: null,
  website: null,
  source_url: '',
  last_verified,
});

describe('placeStatus', () => {
  const today = new Date(2026, 9, 31); // 31 Oct 2026

  it.each([
    ['2026-10-31', 'verified'], // checked today
    ['2026-06-15', 'verified'],
    ['2026-05-01', 'verified'], // six months end on 1 Nov
    ['2026-04-30', 'stale'], // six months ended on 30 Oct
    ['2025-10-31', 'stale'],
    [null, 'unverified'],
    ['soon', 'unverified'],
    ['2026-11-01', 'unverified'], // in the future: cannot be right
  ])('checked %p → %s', (date, expected) => {
    expect(placeStatus(place(date), today)).toBe(expected);
  });

  it('turns stale the day after six months have passed', () => {
    const p = place('2026-04-27');
    expect(placeStatus(p, new Date(2026, 9, 27))).toBe('verified');
    expect(placeStatus(p, new Date(2026, 9, 28))).toBe('stale');
  });
});
