import i18n, { type InitOptions, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import HttpBackend from 'i18next-http-backend';
import LanguageDetector from 'i18next-browser-languagedetector';
import nextI18NextConfig from '../next-i18next.config.js';
import heCommon from '../public/locales/he/common.json';
import enCommon from '../public/locales/en/common.json';
import trCommon from '../public/locales/tr/common.json';

const isBrowser = typeof window !== 'undefined';
const resources: Resource = {
  he: { common: heCommon },
  en: { common: enCommon },
  tr: { common: trCommon },
};

if (!i18n.isInitialized) {
  if (isBrowser) {
    i18n.use(HttpBackend).use(LanguageDetector);
  }

  const initOptions: InitOptions = {
    ...nextI18NextConfig.i18n,
    fallbackLng: nextI18NextConfig.i18n.defaultLocale,
    interpolation: {
      escapeValue: false,
    },
    ns: ['common'],
    defaultNS: 'common',
    react: {
      useSuspense: false,
    },
    resources,
  };

  if (isBrowser) {
    initOptions.backend = {
      loadPath: '/locales/{{lng}}/{{ns}}.json',
    };
  }

  i18n.use(initReactI18next).init(initOptions);
}

export default i18n;
