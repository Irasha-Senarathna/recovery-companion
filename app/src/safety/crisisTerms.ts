/**
 * Crisis phrases (self-harm, suicide, overdose, "can't go on").
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
export const CRISIS_TERMS = {
  en: {
    status: 'source',
    patterns: [
      // Suicide and wanting to die
      'suicid\\w*',
      'kill(ing)? my ?self',
      'kms',
      'end(ing)? my (own )?life',
      'take my (own )?life',
      'end it all',
      'hang(ing)? my ?self',
      '(want|wanna|going) to die',
      'wanna die',
      'better off dead',
      "wish (i|i'm|i am) (was |were )?dead",
      'no reason to live',
      'nothing (left )?to live for',
      'no point (in )?living',
      "(don'?t|do not) want to (live|be here|be alive)( anymore)?",
      // Self-harm
      'self[ -]?harm\\w*',
      '(hurt|harm|cut)(ing|ting)? my ?self',
      // Overdose and emergencies
      'overdos\\w*',
      "od'?d",
      'took too (much|many( pills)?)',
      'not breathing',
      "(won'?t|will not|can'?t|cannot|can not) wake (up|him|her|them)",
      'unresponsive',
      'blue lips',
      // Can't go on / hopelessness
      "(can'?t|cannot|can not) go on",
      "(can'?t|cannot|can not) (take|do) (it|this) (any ?more)",
      'no way out',
      'hopeless',
    ],
  },
  si: {
    status: 'needs_review',
    terms: [
      'සියදිවි',
      'දිවි නසා',
      'මැරෙන්න ඕනේ',
      'මැරෙන්න ඕන',
      'මැරෙන්න හිතෙනවා',
      'ජීවිතය නැති කරගන්න',
      'ජීවිතේ එපා',
      'මට තවත් බෑ',
      'තවත් බෑ',
      'මටම හානි',
      'අධික මාත්‍රා',
      'හුස්ම ගන්නේ නෑ',
    ],
  },
  ta: {
    status: 'needs_review',
    terms: [
      'தற்கொலை',
      'சாக வேண்டும்',
      'சாகணும்',
      'செத்துப் போகணும்',
      'சாக விரும்புகிறேன்',
      'உயிரை மாய்த்து',
      'இனி என்னால் முடியாது',
      'இனி முடியாது',
      'என்னை காயப்படுத்த',
      'அதிக அளவு',
      'மூச்சு விடவில்லை',
    ],
  },
  romanised: {
    status: 'needs_review',
    patterns: [
      // Sinhala in Latin letters
      'mar[ae]nn?a',
      'jee?withe? epa',
      'jivithe? epa',
      'siyadivi',
      'thawath ba',
      // Tamil in Latin letters
      'saga(num|venum|vendum)',
      'tha(t|r)?kolai',
      'ini mudiyathu',
    ],
  },
} as const;
