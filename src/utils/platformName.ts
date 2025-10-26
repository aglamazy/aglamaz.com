import { DEFAULT_PLATFORM_NAME, DEFAULT_SITE_NAME } from '@/constants/platform';
import type { ISite } from '@/entities/Site';

/**
 * Gets the platform name from site info with fallback to default.
 * Allows white-labeling by reading platformName from the site document.
 *
 * @param siteInfo - Site information object
 * @returns Platform name (e.g., "FamCircle", "CustomBrand")
 */
export function getPlatformName(siteInfo: ISite | Record<string, any> | null | undefined): string {
  if (!siteInfo) {
    return DEFAULT_PLATFORM_NAME;
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

  // Try to get translated name if locale is provided
  if (locale && siteInfo.translations) {
    const translated = siteInfo.translations[locale];
    if (translated) {
      return translated;
    }
  }

  // Fall back to default name
  return (siteInfo.name as string) || DEFAULT_SITE_NAME;
}
