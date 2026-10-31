import content from '../../../../content/support_places.json';
import type { Language } from '../../i18n';
import { verificationStatus, type VerificationStatus } from '../help/helplines';

export const PLACE_TYPES = ['treatment_centre', 'counselling', 'support_group'] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export type Localized = Record<Language, string>;

export type SupportPlace = {
  id: string;
  /** Placeholder, not a real place: shown with a badge and never contactable. */
  demo: boolean;
  type: PlaceType;
  name: Localized;
  area: Localized;
  hours: Localized;
  phone: string | null;
  website: string | null;
  source_url: string;
  last_verified: string | null;
};

export type PlaceFilter = { type: PlaceType | null; area: string | null };

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');
const isPlaceType = (v: unknown): v is PlaceType => PLACE_TYPES.includes(v as PlaceType);

/** A plain string is taken as the English text. */
function localized(raw: unknown): Localized {
  const value = isRecord(raw) ? raw : { en: raw };
  return { en: str(value.en), si: str(value.si), ta: str(value.ta) };
}

/** Only https links may be opened; anything else is dropped. */
export function safeWebsite(url: unknown): string | null {
  const trimmed = str(url).trim();
  return /^https:\/\/[^\s]+$/i.test(trimmed) ? trimmed : null;
}

function parsePlace(raw: unknown): SupportPlace | null {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isPlaceType(raw.type)) return null;
  const name = localized(raw.name);
  const area = localized(raw.area);
  if (name.en.trim() === '' || area.en.trim() === '') return null;
  // Anything not explicitly marked real is a demo, and a demo is never dialled.
  const demo = raw.demo !== false;
  // A real place is only contactable when its details cite an https source.
  const contactable = !demo && safeWebsite(raw.source_url) !== null;
  const phone = contactable && str(raw.phone).trim() !== '' ? str(raw.phone) : null;
  return {
    id: raw.id,
    demo,
    type: raw.type,
    name,
    area,
    hours: localized(raw.hours),
    phone,
    website: contactable ? safeWebsite(raw.website) : null,
    source_url: str(raw.source_url),
    last_verified: typeof raw.last_verified === 'string' ? raw.last_verified : null,
  };
}

/** Validates the content file; malformed or repeated entries are dropped, never guessed. */
export function parsePlaces(raw: unknown): SupportPlace[] {
  if (!isRecord(raw) || !Array.isArray(raw.places)) return [];
  const seen = new Set<string>();
  return raw.places
    .map(parsePlace)
    .filter((p): p is SupportPlace => p !== null && !seen.has(p.id) && !!seen.add(p.id));
}

/** Bundled with the app, so the finder works offline. */
export function loadPlaces(): SupportPlace[] {
  return parsePlaces(content);
}

/** Same six-month rule as the help contacts. */
export function placeStatus(place: SupportPlace, today: Date): VerificationStatus {
  return verificationStatus(place.last_verified, today);
}

/** Areas are filtered by their English name, which is stable across languages. */
export function listAreas(places: SupportPlace[]): string[] {
  return [...new Set(places.map((p) => p.area.en))];
}

export function filterPlaces(places: SupportPlace[], filter: PlaceFilter): SupportPlace[] {
  return places.filter(
    (p) =>
      (filter.type === null || p.type === filter.type) &&
      (filter.area === null || p.area.en === filter.area),
  );
}

export function inLanguage(text: Localized, language: Language): string {
  return text[language] || text.en;
}
