import content from '../../../../content/helplines.json';
import type { Language } from '../../i18n';

export type HelplineType = 'emergency' | 'helpline' | 'treatment' | 'other';

export type HelplineEntry = {
  id: string;
  type: HelplineType;
  name: Record<Language, string>;
  phone: string;
  hours: string;
  source_url: string;
  last_verified: string | null;
};

export type VerificationStatus = 'verified' | 'stale' | 'unverified';

const STALE_AFTER_MONTHS = 6;
const TYPES: HelplineType[] = ['emergency', 'helpline', 'treatment', 'other'];

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

function parseEntry(raw: unknown): HelplineEntry | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.phone !== 'string') return null;
  if (raw.phone.trim() === '') return null;
  const name = isRecord(raw.name) ? raw.name : {};
  return {
    id: raw.id,
    type: TYPES.includes(raw.type as HelplineType) ? (raw.type as HelplineType) : 'other',
    name: { en: str(name.en), si: str(name.si), ta: str(name.ta) },
    phone: raw.phone,
    hours: str(raw.hours),
    source_url: str(raw.source_url),
    last_verified: typeof raw.last_verified === 'string' ? raw.last_verified : null,
  };
}

/** Validates the content file; malformed entries are dropped, never guessed. */
export function parseHelplines(raw: unknown): HelplineEntry[] {
  if (!isRecord(raw) || !Array.isArray(raw.entries)) return [];
  return raw.entries.map(parseEntry).filter((e): e is HelplineEntry => e !== null);
}

/** Safety rule 3: numbers come only from content/helplines.json. */
export function loadHelplines(): HelplineEntry[] {
  return parseHelplines(content);
}

function parseDate(value: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const [year, month, day] = match.slice(1).map(Number);
  const date = new Date(year, month - 1, day);
  return date.getMonth() === month - 1 && date.getDate() === day ? date : null;
}

export function verificationStatus(lastVerified: string | null, today: Date): VerificationStatus {
  const checked = lastVerified ? parseDate(lastVerified) : null;
  if (!checked || checked > today) return 'unverified';
  const staleFrom = new Date(checked);
  staleFrom.setMonth(staleFrom.getMonth() + STALE_AFTER_MONTHS);
  return today > staleFrom ? 'stale' : 'verified';
}

/** A dialable `tel:` link: digits (and a leading +) of the first number in a range. */
export function telUri(phone: string): string {
  const first = phone.split(/\s[-–/]\s|,/)[0];
  const plus = first.trim().startsWith('+') ? '+' : '';
  return `tel:${plus}${first.replace(/\D/g, '')}`;
}

/**
 * Only an entry with a name that has been checked may be presented as
 * emergency services: a wrong number must never be the big red button.
 */
export function isTrustedEmergency(entry: HelplineEntry, today: Date): boolean {
  return (
    entry.type === 'emergency' &&
    entry.name.en.trim() !== '' &&
    verificationStatus(entry.last_verified, today) !== 'unverified'
  );
}

export function displayName(entry: HelplineEntry, language: Language): string | null {
  return entry.name[language] || entry.name.en || null;
}
