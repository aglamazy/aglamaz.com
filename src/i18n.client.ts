'use client';
import { createInstance, type i18n as I18nType, type Resource } from 'i18next';
import { initReactI18next } from 'react-i18next';
import nextI18NextConfig from '../next-i18next.config.js';
import { DEFAULT_LOCALE, DEFAULT_RESOURCES } from './i18n';

interface CreateI18nOptions {
  locale: string;
  resources?: Resource;
}

export function createI18nInstance({ locale, resources }: CreateI18nOptions): I18nType {
  const instance = createInstance();
  instance.use(initReactI18next);

  instance.init({
    ...nextI18NextConfig.i18n,
    lng: locale,
    fallbackLng: DEFAULT_LOCALE,
    ns: ['common'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    react: {
      useSuspense: false,
    },
    resources: resources ?? DEFAULT_RESOURCES,
    initImmediate: false,
  });

  return instance;
}
