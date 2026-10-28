import { render, screen } from '@testing-library/react-native';
import '../../../i18n';
import realFile from '../../../../../content/helplines.json';
import {
  displayName,
  isTrustedEmergency,
  loadHelplines,
  parseHelplines,
  telUri,
  verificationStatus,
  type HelplineEntry,
} from '../helplines';
import { HelplineList } from '../HelplineList';

const entry = (overrides: Partial<HelplineEntry> = {}): HelplineEntry => ({
  id: 'drug-helpline',
  type: 'helpline',
  name: { en: 'Demo helpline', si: '', ta: '' },
  phone: '0000 000',
  hours: '24 hours',
  source_url: 'https://example.org',
  last_verified: '2026-09-01',
  ...overrides,
});

describe('loadHelplines', () => {
  it('reads content/helplines.json (never hard-coded numbers)', () => {
    const phones = realFile.entries.map((e) => e.phone).filter((p) => p.trim() !== '');
    expect(loadHelplines().map((e) => e.phone)).toEqual(phones);
  });
});

describe('parseHelplines', () => {
  it('keeps well-formed entries', () => {
    expect(parseHelplines({ entries: [entry()] })).toEqual([entry()]);
  });

  it('skips entries without a phone number', () => {
    expect(parseHelplines({ entries: [entry({ phone: '  ' }), entry({ id: 'b' })] })).toEqual([
      entry({ id: 'b' }),
    ]);
  });

  it.each([null, 'text', {}, { entries: 'x' }, { entries: [{ id: 1 }] }])(
    'returns no entries for malformed content (%p)',
    (raw) => {
      expect(parseHelplines(raw)).toEqual([]);
    },
  );
});

describe('verificationStatus', () => {
  const today = new Date(2026, 9, 27); // 27 Oct 2026

  it.each([
    [null, 'unverified'],
    ['', 'unverified'],
    ['not a date', 'unverified'],
    ['2026-13-40', 'unverified'],
    ['2027-01-01', 'unverified'], // in the future: cannot be right
    ['2026-10-27', 'verified'],
    ['2026-06-01', 'verified'],
    ['2026-04-27', 'verified'], // exactly 6 months
    ['2026-04-26', 'stale'],
    ['2025-01-01', 'stale'],
  ])('%p → %s', (date, expected) => {
    expect(verificationStatus(date, today)).toBe(expected);
  });
});

describe('telUri', () => {
  it.each([
    ['1927', 'tel:1927'],
    ['011 309 1394', 'tel:0113091394'],
    ['+94 11 2868794 - 6', 'tel:+94112868794'],
    ['(011) 234-5678', 'tel:0112345678'],
  ])('%s → %s', (phone, uri) => {
    expect(telUri(phone)).toBe(uri);
  });
});

describe('isTrustedEmergency', () => {
  const today = new Date(2026, 9, 27);

  it('needs the emergency type, a name and a checked date', () => {
    expect(isTrustedEmergency(entry({ type: 'emergency' }), today)).toBe(true);
    expect(isTrustedEmergency(entry({ type: 'helpline' }), today)).toBe(false);
    expect(
      isTrustedEmergency(entry({ type: 'emergency', name: { en: '', si: '', ta: '' } }), today),
    ).toBe(false);
    expect(isTrustedEmergency(entry({ type: 'emergency', last_verified: null }), today)).toBe(
      false,
    );
  });
});

describe('displayName', () => {
  it('uses the name in the current language, then English, then nothing', () => {
    const e = entry({ name: { en: 'Helpline', si: 'උපකාරක', ta: '' } });
    expect(displayName(e, 'si')).toBe('උපකාරක');
    expect(displayName(e, 'ta')).toBe('Helpline');
    expect(displayName(entry({ name: { en: '', si: '', ta: '' } }), 'en')).toBeNull();
  });
});

describe('HelplineList', () => {
  const today = new Date(2026, 9, 27);

  it('shows each number with a call button and its last-checked date', async () => {
    await render(<HelplineList entries={[entry()]} today={today} />);
    expect(screen.getByText('0000 000')).toBeOnTheScreen();
    expect(screen.getByRole('button', { name: /call demo helpline/i })).toBeOnTheScreen();
    expect(screen.getByText(/last checked/i)).toBeOnTheScreen();
  });

  it('warns about unverified entries', async () => {
    await render(<HelplineList entries={[entry({ last_verified: null })]} today={today} />);
    expect(screen.getByText(/not yet checked/i)).toBeOnTheScreen();
  });

  it('warns about entries checked more than 6 months ago', async () => {
    await render(<HelplineList entries={[entry({ last_verified: '2025-12-01' })]} today={today} />);
    expect(screen.getByText(/more than 6 months ago/i)).toBeOnTheScreen();
  });

  it('falls back to a type label when the entry has no name yet', async () => {
    const unnamed = entry({ type: 'helpline', name: { en: '', si: '', ta: '' } });
    await render(<HelplineList entries={[unnamed]} today={today} />);
    expect(screen.getByText('Helpline')).toBeOnTheScreen();
  });

  it('never labels an unnamed or unchecked entry as emergency services', async () => {
    const unnamed = entry({ type: 'emergency', name: { en: '', si: '', ta: '' } });
    const unchecked = entry({ id: 'b', type: 'emergency', last_verified: null });
    await render(<HelplineList entries={[unnamed, unchecked]} today={today} />);
    expect(screen.queryByText('Emergency services')).toBeNull();
    expect(screen.getByText('Support contact')).toBeOnTheScreen();
  });

  it('says when no contacts are set up', async () => {
    await render(<HelplineList entries={[]} today={today} />);
    expect(screen.getByText(/have not been set up/i)).toBeOnTheScreen();
  });
});
