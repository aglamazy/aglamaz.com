import type { Resource } from 'i18next';
import nextI18NextConfig from '../next-i18next.config.js';
import heCommon from '../public/locales/he/common.json';
import enCommon from '../public/locales/en/common.json';
import { SUPPORTED_LOCALES as CONFIG_LOCALES } from '@/constants/i18n';

export const SUPPORTED_LOCALES = (nextI18NextConfig?.i18n?.locales ?? CONFIG_LOCALES)
  .filter((locale) => CONFIG_LOCALES.includes(locale as any)) as string[];

export const DEFAULT_LOCALE =
  (typeof nextI18NextConfig?.i18n?.defaultLocale === 'string'
    ? nextI18NextConfig.i18n.defaultLocale
    : 'en') ?? 'en';

export const DEFAULT_RESOURCES: Resource = {
  en: { common: enCommon },
  he: { common: heCommon },
};
