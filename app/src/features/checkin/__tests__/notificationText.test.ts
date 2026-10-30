import en from '../../../i18n/locales/en.json';
import si from '../../../i18n/locales/si.json';
import ta from '../../../i18n/locales/ta.json';

/**
 * Privacy: a reminder can show on a locked or shared phone, so its text must
 * never hint at drugs, alcohol, cravings or recovery. Sinhala and Tamil terms
 * are a starting list until a native speaker reviews them.
 */
const BANNED: Record<string, RegExp[]> = {
  en: [
    /drug/i,
    /alcohol|drink/i,
    /crav/i,
    /relapse|slip/i,
    /recover/i,
    /addict/i,
    /sober|sobriety|clean/i,
    /\b(use|using|used)\b/i,
    /substance|rehab|treatment|pill|dose/i,
    /urge|trigger|risk/i,
  ],
  si: [/මත්/, /ඇබ්බැහි/, /මත්පැන්/, /සුවවීම/, /ඖෂධ/, /ප්‍රතිකාර/, /ආශාව/],
  ta: [/போதை/, /அடிமை/, /மது/, /மீட்பு/, /மருந்து/, /சிகிச்சை/, /ஏக்கம்/],
};

const locales = { en, si, ta } as const;

describe.each(Object.keys(locales) as (keyof typeof locales)[])(
  'reminder notification text (%s)',
  (lang) => {
    const texts = Object.values(locales[lang].notifications);

    it('has a title and body', () => {
      expect(locales[lang].notifications.reminderTitle.trim()).not.toBe('');
      expect(locales[lang].notifications.reminderBody.trim()).not.toBe('');
    });

    it.each(BANNED[lang].map((p) => [p.source, p]))('never contains %s', (_, pattern) => {
      expect(texts.filter((text) => (pattern as RegExp).test(text))).toEqual([]);
    });
  },
);
