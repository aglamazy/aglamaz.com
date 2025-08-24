import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import nextI18NextConfig from '../next-i18next.config.js';

const isBrowser = typeof window !== 'undefined';

if (!i18n.isInitialized) {
  if (isBrowser) {
    i18n.use(HttpBackend).use(LanguageDetector);
  }
  i18n
    .use(initReactI18next)
    .init({
      ...nextI18NextConfig.i18n,
      fallbackLng: nextI18NextConfig.i18n.defaultLocale,
      backend: {
        loadPath: '/locales/{{lng}}/{{ns}}.json'
      },
      interpolation: {
        escapeValue: false,
      },
      ns: ['common'],
      defaultNS: 'common',
    });
}

export default i18n;