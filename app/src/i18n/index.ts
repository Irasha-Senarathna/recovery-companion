import { getLocales } from 'expo-localization';
import { createInstance } from 'i18next';
import { initReactI18next } from 'react-i18next';
import en from './locales/en.json';
import si from './locales/si.json';
import ta from './locales/ta.json';

export const LANGUAGES = ['en', 'si', 'ta'] as const;
export type Language = (typeof LANGUAGES)[number];

export function isLanguage(code: string | null | undefined): code is Language {
  return LANGUAGES.includes(code as Language);
}

/** The device language if we support it, otherwise English. */
export function deviceLanguage(): Language {
  const code = getLocales()[0]?.languageCode;
  return isLanguage(code) ? code : 'en';
}

const i18n = createInstance();

i18n.use(initReactI18next).init({
  resources: { en: { translation: en }, si: { translation: si }, ta: { translation: ta } },
  lng: deviceLanguage(),
  fallbackLng: 'en',
  initAsync: false,
  interpolation: { escapeValue: false },
});

export default i18n;
