import { CRISIS_TERMS, detectCrisis } from '../crisisDetector';

describe('crisis detector (safety rule 4)', () => {
  it.each([
    'I want to kill myself',
    'thinking about SUICIDE again',
    "I can't go on",
    'i cant go on like this',
    'I can’t go on', // curly apostrophe
    'I want to hurt myself',
    'I might self-harm tonight',
    'my friend overdosed',
    'I think I took an overdose',
    'he is not breathing',
    'I want to die',
    'I want to end my life',
    'better off dead',
    // Word endings and spelling variants
    'I keep overdosing',
    'self harming again',
    'been self-harming',
    'hurting myself helps',
    'cutting myself',
    'kill my self',
    'kms',
    'I want to take my own life',
    'I might hang myself',
    "i dont want to live anymore",
    "I don't want to be here anymore",
    'I wish I was dead',
    'nothing to live for',
    "I can't take it anymore",
    "can't do this anymore",
    'no point living',
    'I can not go on',
    'she wont wake up',
    "I can't wake him",
    'he took too many pills',
    'my friend ODd',
    'he is unresponsive',
    'his lips are blue lips',
    'it feels hopeless',
    'there is no way out',
    'I can\u2019t go on', // curly apostrophe
    'self\u2013harm', // en dash
  ])('en: detects %p', (text) => {
    expect(detectCrisis(text)).toBe(true);
  });

  it.each(['මට මැරෙන්න ඕනේ', 'සියදිවි නසා ගන්න හිතෙනවා', 'මට තවත් බෑ', 'අධික මාත්‍රාවක් ගත්තා'])(
    'si: detects %p',
    (text) => {
      expect(detectCrisis(text)).toBe(true);
    },
  );

  it.each(['maranna ona', 'mata maranna hithenawa', 'jeewithe epa', 'saganum', 'thatkolai'])(
    'romanised si/ta: detects %p',
    (text) => {
      expect(detectCrisis(text)).toBe(true);
    },
  );

  it.each(['මැරෙන්න හිතෙනවා', 'ජීවිතේ එපා', 'சாகணும்'])(
    'spoken forms: detects %p',
    (text) => {
      expect(detectCrisis(text)).toBe(true);
    },
  );

  it.each([
    'நான் தற்கொலை செய்ய நினைக்கிறேன்',
    'எனக்கு சாக வேண்டும்',
    'இனி என்னால் முடியாது',
    'அதிக அளவு எடுத்துவிட்டேன்',
  ])('ta: detects %p', (text) => {
    expect(detectCrisis(text)).toBe(true);
  });

  it.each([
    '',
    'I had a good day',
    'went for a walk with my sister',
    'my skills class went well',
    'I can go on a trip next week',
    'the methodist church', // contains "od" inside a word
    'my mood is better',
    'I took too long at lunch',
    'මට අද හොඳයි',
    'இன்று நல்ல நாள்',
  ])('does not flag everyday text %p', (text) => {
    expect(detectCrisis(text)).toBe(false);
  });

  it('checks every language, whatever the app language is', () => {
    expect(Object.keys(CRISIS_TERMS).sort()).toEqual(['en', 'romanised', 'si', 'ta']);
  });

  it('marks si/ta and romanised word lists for native-speaker review', () => {
    expect(CRISIS_TERMS.si.status).toBe('needs_review');
    expect(CRISIS_TERMS.ta.status).toBe('needs_review');
    expect(CRISIS_TERMS.romanised.status).toBe('needs_review');
  });
});
