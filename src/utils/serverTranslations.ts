import i18next, { type TFunction } from 'i18next';
import nextI18NextConfig from '../../next-i18next.config.js';
import heCommon from '../../public/locales/he/common.json';
import enCommon from '../../public/locales/en/common.json';
import trCommon from '../../public/locales/tr/common.json';

const resources = {
  he: { common: heCommon },
  en: { common: enCommon },
  tr: { common: trCommon },
};

const serverI18n = i18next.createInstance();
let initPromise: Promise<TFunction<'common'>> | null = null;

async function ensureInitialized() {
  if (serverI18n.isInitialized) return;
  if (!initPromise) {
    initPromise = serverI18n.init({
      resources,
      fallbackLng: nextI18NextConfig.i18n.defaultLocale,
      interpolation: {
        escapeValue: false,
      },
      ns: ['common'],
      defaultNS: 'common',
    });
  }
  await initPromise;
}

export async function getServerT(locale: string) {
  await ensureInitialized();
  const lang = locale.split('-')[0];
  return serverI18n.getFixedT(lang, 'common');
}
