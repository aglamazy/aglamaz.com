import type { ISite } from '@/entities/Site';

export function getLocalizedSiteName  (site: ISite | null | undefined, locale: string | undefined): string | null | undefined{
  if (!site) return undefined;
  const translations = site.translations || {};
  if (locale && translations[locale]) {
    return translations[locale];
  }
  return site.name;
}
