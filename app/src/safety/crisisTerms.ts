/**
 * Crisis phrases (self-harm, suicide, overdose, "can't go on"), read from
 * `content/crisis_terms.json` so the coach service checks the same words.
 *
 * - `en` entries are regular-expression fragments matched on word boundaries
 *   after normalising (lower case, straight apostrophes, single spaces), so
 *   stems like `overdos\w*` catch "overdosing" and "overdosed".
 * - `si`/`ta` entries are plain substrings in Sinhala/Tamil script.
 * - `romanised` covers Sinhala and Tamil typed in Latin letters
 *   ("Singlish"/"Tanglish"), matched on word boundaries.
 *
 * si, ta and romanised lists are drafts that need native-speaker review.
 * Err on the side of showing help: a false alarm only opens the help screen.
 */
import terms from '../../../content/crisis_terms.json';

export const CRISIS_TERMS = {
  en: terms.en,
  si: terms.si,
  ta: terms.ta,
  romanised: terms.romanised,
};
