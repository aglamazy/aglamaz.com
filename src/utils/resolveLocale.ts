import { headers } from 'next/headers';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import {
  findBestMatchingTag,
  findBestSupportedLocale,
  parseAcceptLanguage,
  sanitizeLocaleCandidate,
} from './locale';

export interface LocaleResolutionResult {
  baseLocale: string;
  resolvedLocale: string;
}

// No extraction function needed - middleware sets x-locale header

/**
 * Resolves locale with priority:
 * 1. Query param (?locale=) - from x-locale header (set by middleware)
 * 2. Member preference (if provided)
 * 3. Accept-Language header
 */
export async function resolveLocaleForPrivateRoutes(
  memberDefaultLocale?: string | null
): Promise<LocaleResolutionResult> {
  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language');
  const preferences = parseAcceptLanguage(acceptLanguage);
  const acceptLanguageLocale = findBestSupportedLocale(preferences, SUPPORTED_LOCALES) ?? DEFAULT_LOCALE;

  // Get locale from query param (set by proxy as x-locale header)
  const queryLocaleCandidate = headerStore.get('x-locale');
  const queryLocale = sanitizeLocaleCandidate(queryLocaleCandidate, SUPPORTED_LOCALES);

  // Priority: query param > member preference > Accept-Language header
  let baseLocale = queryLocale;
  if (!baseLocale) {
    const memberLocale = sanitizeLocaleCandidate(memberDefaultLocale, SUPPORTED_LOCALES);
    baseLocale = memberLocale ?? acceptLanguageLocale;
  }

  const resolvedLocale = findBestMatchingTag(preferences, baseLocale) ?? baseLocale;

  return {
    baseLocale,
    resolvedLocale,
  };
}

/**
 * Resolves locale for public routes (from path segment)
 */
export function resolveLocaleForPublicRoutes(
  pathLocale: string
): LocaleResolutionResult {
  const baseLocale = SUPPORTED_LOCALES.includes(pathLocale) ? pathLocale : DEFAULT_LOCALE;

  return {
    baseLocale,
    resolvedLocale: baseLocale,
  };
}
