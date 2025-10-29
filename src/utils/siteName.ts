import type { ISite } from '@/entities/Site';
import { getLocalizedFields } from '@/services/LocalizationService';

export function getLocalizedSiteName(
  site: ISite | null | undefined,
  locale: string | undefined
): string | null | undefined {
  if (!site) return undefined;

  const localized = getLocalizedFields(site, locale, ['name']);

  return localized.name;
}
