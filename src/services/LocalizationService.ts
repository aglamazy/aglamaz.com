/**
 * Generic LocalizationService for handling document translations
 *
 * Provides type-safe helpers for working with translatable documents
 * following a consistent pattern across the application.
 */

export interface TranslationEntry {
  translatedAt: any;
  engine: 'gpt' | 'manual' | 'other';
  [key: string]: any; // Allow additional fields
}

export interface LocalizableDocument<TFields extends Record<string, any>> {
  sourceLang: string;
  translations?: Record<string, TFields & TranslationEntry>;
  translationMeta?: {
    requested?: Record<string, any>;
    attempts?: number;
  };
}

/**
 * Normalizes a language code to its base form (e.g., 'en-US' -> 'en')
 */
export function normalizeLang(input?: string | null): string | null {
  if (!input) return null;
  try {
    const code = input.split(',')[0]?.trim().split(';')[0] || '';
    const base = code.split('-')[0]?.toLowerCase();
    return base || null;
  } catch {
    return null;
  }
}

/**
 * Gets a localized version of a document by returning translated fields for the given locale
 *
 * @param document - The document with translations
 * @param locale - The target locale
 * @param fields - Array of field names to localize
 * @returns Object with localized field values
 */
export function getLocalizedFields<
  TDoc extends LocalizableDocument<TFields>,
  TFields extends Record<string, any>
>(
  document: TDoc,
  locale: string | null | undefined,
  fields: (keyof TFields)[]
): Partial<TFields> {
  if (!locale || locale === document.sourceLang) {
    return {};
  }

  const translations = document.translations || {};
  const normalizedLocale = normalizeLang(locale);

  if (!normalizedLocale) {
    return {};
  }

  // Try exact match first
  let translation = translations[locale];

  // Try normalized base language
  if (!translation && normalizedLocale) {
    const key = Object.keys(translations).find(k => {
      const kb = normalizeLang(k);
      return k.toLowerCase() === locale.toLowerCase() || kb === normalizedLocale;
    });
    if (key) {
      translation = translations[key];
    }
  }

  if (!translation) {
    return {};
  }

  // Extract only the requested fields
  const result: Partial<TFields> = {};
  for (const field of fields) {
    if (translation[field as string] !== undefined) {
      result[field] = translation[field as string];
    }
  }

  return result;
}

/**
 * Applies localized fields to a document, returning a new object with translated values
 *
 * @param document - The document to localize
 * @param locale - The target locale
 * @param fields - Array of field names to localize
 * @returns New document with localized field values
 */
export function getLocalizedDocument<
  TDoc extends LocalizableDocument<TFields> & Record<string, any>,
  TFields extends Record<string, any>
>(
  document: TDoc,
  locale: string | null | undefined,
  fields: (keyof TFields)[]
): TDoc {
  const localizedFields = getLocalizedFields(document, locale, fields);

  if (Object.keys(localizedFields).length === 0) {
    return document;
  }

  return {
    ...document,
    ...localizedFields,
  };
}

/**
 * Checks if a translation exists for the given locale
 */
export function hasTranslation<TFields extends Record<string, any>>(
  document: LocalizableDocument<TFields>,
  locale: string
): boolean {
  const normalizedLocale = normalizeLang(locale);
  if (!normalizedLocale) return false;

  const translations = document.translations || {};

  // Check exact match
  if (translations[locale]) return true;

  // Check normalized match
  return Object.keys(translations).some(k => {
    const kb = normalizeLang(k);
    return k.toLowerCase() === locale.toLowerCase() || kb === normalizedLocale;
  });
}

/**
 * Determines if a translation should be requested for the given locale
 *
 * @param document - The document to check
 * @param locale - The target locale
 * @param debounceMs - Minimum time (in ms) between translation requests (default: 1 hour)
 * @returns true if translation should be requested
 */
export function shouldRequestTranslation<TFields extends Record<string, any>>(
  document: LocalizableDocument<TFields>,
  locale: string,
  debounceMs: number = 60 * 60 * 1000 // 1 hour default
): boolean {
  const normalizedLocale = normalizeLang(locale);
  if (!normalizedLocale) return false;

  // Don't translate if it's the source language
  if (normalizedLocale === document.sourceLang) return false;

  // Don't translate if translation already exists
  if (hasTranslation(document, locale)) return false;

  // Check if recently requested (debounce)
  const lastReq = document.translationMeta?.requested?.[normalizedLocale] as any;
  if (lastReq) {
    const lastMs = lastReq?.toMillis ? lastReq.toMillis() : (lastReq ? new Date(lastReq).getTime() : 0);
    const now = Date.now();
    if (lastMs && now - lastMs < debounceMs) {
      return false;
    }
  }

  return true;
}
