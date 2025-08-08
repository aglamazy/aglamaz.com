import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import nextI18NextConfig from '../next-i18next.config.js';

if (!i18n.isInitialized) {
  i18n
    .use(HttpBackend)
    .use(LanguageDetector)
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