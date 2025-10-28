import { DEFAULT_PLATFORM_NAME, DEFAULT_SITE_NAME } from '@/constants/platform';
import type { ISite } from '@/entities/Site';
import { getLocalizedFields } from '@/services/LocalizationService';

/**
 * Gets the platform name from site info with fallback to default.
 * Allows white-labeling by reading platformName from the site document.
 *
 * @param siteInfo - Site information object
 * @param locale - Optional locale for translated name
 * @returns Platform name (e.g., "FamCircle", "CustomBrand")
 */
export function getPlatformName(
  siteInfo: ISite | Record<string, any> | null | undefined,
  locale?: string
): string {
  if (!siteInfo) {
    return DEFAULT_PLATFORM_NAME;
  }

  // Try to get localized platform name if locale is provided and site has translations
  if (locale && 'translations' in siteInfo && 'sourceLang' in siteInfo) {
    const localized = getLocalizedFields(siteInfo as ISite, locale, ['platformName']);
    if (localized.platformName) {
      return localized.platformName.trim();
    }
  }

  // Check if platformName is explicitly set
  if (typeof siteInfo.platformName === 'string' && siteInfo.platformName.trim()) {
    return siteInfo.platformName.trim();
  }

  // Fall back to default
  return DEFAULT_PLATFORM_NAME;
}

/**
 * Gets the site/family name from site info with fallback to default.
 *
 * @param siteInfo - Site information object
 * @param locale - Optional locale for translated name
 * @returns Site/family name
 */
export function getSiteName(
  siteInfo: ISite | Record<string, any> | null | undefined,
  locale?: string
): string {
  if (!siteInfo) {
    return DEFAULT_SITE_NAME;
  }

  // Try to get translated name if locale is provided and site has translations
  if (locale && 'translations' in siteInfo && 'sourceLang' in siteInfo) {
    const localized = getLocalizedFields(siteInfo as ISite, locale, ['name']);
    if (localized.name) {
      return localized.name;
    }
  }

  // Fall back to default name
  return (siteInfo.name as string) || DEFAULT_SITE_NAME;
}

/**
 * Gets the about family description from site info.
 *
 * @param siteInfo - Site information object
 * @param locale - Optional locale for translated description
 * @returns About family description or empty string
 */
export function getAboutFamily(
  siteInfo: ISite | Record<string, any> | null | undefined,
  locale?: string
): string {
  if (!siteInfo) {
    return '';
  }

  // Try to get translated description if locale is provided and site has translations
  if (locale && 'translations' in siteInfo && 'sourceLang' in siteInfo) {
    const localized = getLocalizedFields(siteInfo as ISite, locale, ['aboutFamily']);
    if (localized.aboutFamily) {
      return localized.aboutFamily;
    }
  }

  // Fall back to original description
  return (siteInfo.aboutFamily as string) || '';
}
