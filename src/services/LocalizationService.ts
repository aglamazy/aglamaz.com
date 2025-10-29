/**
 * Generic LocalizationService for handling document translations
 *
 * New architecture:
 * - No single "source language" - all locales are equal
 * - Content stored in `locales.{locale}.field` structure
 * - Each field has optional `field$meta` with source and updatedAt
 * - Metadata tracks whether field was manual or auto-translated
 */

export interface FieldMeta {
  source: 'manual' | 'gpt' | 'other';
  updatedAt: any;
}

export interface LocalizableDocument {
  locales: Record<string, Record<string, any>>; // locale -> { field, field$meta, ... }
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
 * Gets localized field values for a specific locale
 *
 * @param document - The document with locales
 * @param locale - The target locale
 * @param fields - Array of field names to retrieve
 * @returns Object with field values (excluding metadata)
 */
export function getLocalizedFields<TDoc extends LocalizableDocument>(
  document: TDoc,
  locale: string | null | undefined,
  fields: string[]
): Record<string, any> {
  if (!locale) {
    return {};
  }

  const locales = document.locales || {};
  const normalizedLocale = normalizeLang(locale);

  if (!normalizedLocale) {
    return {};
  }

  // Try exact match first
  let localeData = locales[locale];

  // Try normalized base language
  if (!localeData && normalizedLocale) {
    const key = Object.keys(locales).find(k => {
      const kb = normalizeLang(k);
      return k.toLowerCase() === locale.toLowerCase() || kb === normalizedLocale;
    });
    if (key) {
      localeData = locales[key];
    }
  }

  if (!localeData) {
    return {};
  }

  // Extract only the requested fields (not metadata)
  const result: Record<string, any> = {};
  for (const field of fields) {
    if (localeData[field] !== undefined) {
      result[field] = localeData[field];
    }
  }

  return result;
}

/**
 * Applies localized fields to a document, returning a new object with field values for the locale
 *
 * @param document - The document to localize
 * @param locale - The target locale
 * @param fields - Array of field names to localize
 * @returns New document with localized field values
 */
export function getLocalizedDocument<TDoc extends LocalizableDocument & Record<string, any>>(
  document: TDoc,
  locale: string | null | undefined,
  fields: string[]
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
 * Checks if content exists for the given locale
 */
export function hasLocale(
  document: LocalizableDocument,
  locale: string
): boolean {
  const normalizedLocale = normalizeLang(locale);
  if (!normalizedLocale) return false;

  const locales = document.locales || {};

  // Check exact match
  if (locales[locale]) return true;

  // Check normalized match
  return Object.keys(locales).some(k => {
    const kb = normalizeLang(k);
    return k.toLowerCase() === locale.toLowerCase() || kb === normalizedLocale;
  });
}

/**
 * Checks if a specific field in a locale is stale
 *
 * A field is considered stale if:
 * - It was AI-generated (source: 'gpt')
 * - The same field exists in another locale with a newer updatedAt timestamp
 *
 * Manual translations (source: 'manual') are never considered stale.
 *
 * @param document - The document to check
 * @param locale - The locale to check
 * @param field - The specific field name to check
 * @returns true if field exists but is stale and should be retranslated
 */
export function isFieldStale(
  document: LocalizableDocument,
  locale: string,
  field: string
): boolean {
  const normalizedLocale = normalizeLang(locale);
  if (!normalizedLocale) return false;

  const locales = document.locales || {};
  const localeData = locales[locale] || locales[normalizedLocale];

  if (!localeData || !localeData[field]) return false;

  const meta = localeData[`${field}$meta`] as FieldMeta | undefined;
  if (!meta) return false;

  // Manual translations are never stale
  if (meta.source === 'manual') return false;

  // AI translations: check if any other locale has newer version of this field
  if (meta.source === 'gpt' && meta.updatedAt) {
    const currentMs = meta.updatedAt?.toMillis
      ? meta.updatedAt.toMillis()
      : new Date(meta.updatedAt).getTime();

    // Check all other locales for newer versions of this field
    for (const [otherLocale, otherData] of Object.entries(locales)) {
      if (otherLocale === locale) continue;

      const otherMeta = otherData[`${field}$meta`] as FieldMeta | undefined;
      if (!otherMeta || !otherMeta.updatedAt) continue;

      const otherMs = otherMeta.updatedAt?.toMillis
        ? otherMeta.updatedAt.toMillis()
        : new Date(otherMeta.updatedAt).getTime();

      // If another locale has a newer version, this translation is stale
      if (otherMs > currentMs) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Determines if content should be created for the given locale
 *
 * @param document - The document to check
 * @param locale - The target locale
 * @returns true if the locale doesn't have any content yet
 */
export function shouldRequestTranslation(
  document: LocalizableDocument,
  locale: string
): boolean {
  const normalizedLocale = normalizeLang(locale);
  if (!normalizedLocale) return false;

  // Check if content already exists for this locale
  return !hasLocale(document, locale);
}

/**
 * Gets the most recently updated version of a field across all locales
 *
 * Useful for determining which locale has the "canonical" version to translate from
 *
 * @param document - The document to check
 * @param field - The field name to check
 * @returns Object with locale and value of the most recent version, or null if not found
 */
export function getMostRecentFieldVersion(
  document: LocalizableDocument,
  field: string
): { locale: string; value: any; updatedAt: any } | null {
  const locales = document.locales || {};
  let mostRecent: { locale: string; value: any; updatedAt: any } | null = null;
  let mostRecentMs = 0;

  for (const [locale, data] of Object.entries(locales)) {
    const value = data[field];
    if (value === undefined) continue;

    const meta = data[`${field}$meta`] as FieldMeta | undefined;
    if (!meta || !meta.updatedAt) continue;

    const updatedMs = meta.updatedAt?.toMillis
      ? meta.updatedAt.toMillis()
      : new Date(meta.updatedAt).getTime();

    if (updatedMs > mostRecentMs) {
      mostRecentMs = updatedMs;
      mostRecent = { locale, value, updatedAt: meta.updatedAt };
    }
  }

  return mostRecent;
}

/**
 * Builds update object for saving localized content
 *
 * New architecture:
 * - All content saved to locales.{locale}.field
 * - Each field gets field$meta with source ('manual' or 'gpt') and updatedAt
 * - No concept of root fields or source language
 *
 * @param document - The current document state
 * @param locale - The locale being saved
 * @param updates - The fields being updated with their new values
 * @param source - Source of the update ('manual' for user input, 'gpt' for auto-translation)
 * @param timestamp - Timestamp for the update
 * @returns Update object ready for Firestore (uses dot notation for nested updates)
 */
export function buildLocalizedUpdate(
  document: LocalizableDocument,
  locale: string,
  updates: Record<string, any>,
  source: 'manual' | 'gpt' | 'other',
  timestamp: any
): Record<string, any> {
  const result: Record<string, any> = {};

  // Build updates for each field with metadata
  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    // Save the field value
    result[`locales.${locale}.${field}`] = value;

    // Save the field metadata
    result[`locales.${locale}.${field}$meta`] = {
      source,
      updatedAt: timestamp,
    };
  }

  return result;
}

/**
 * Saves localized content to Firestore
 *
 * New architecture:
 * - Saves to locales.{locale}.field with field$meta
 * - Updates document-level updatedAt timestamp
 *
 * @param docRef - Firestore document reference
 * @param document - Current document state
 * @param locale - Locale being saved
 * @param updates - Fields to update with their values
 * @param source - Source of the update ('manual' for user input, 'gpt' for auto-translation)
 * @param timestamp - Timestamp for the update
 * @returns Updated document state after save
 */
export async function saveLocalizedContent<TDoc extends LocalizableDocument & Record<string, any>>(
  docRef: FirebaseFirestore.DocumentReference,
  document: TDoc,
  locale: string,
  updates: Record<string, any>,
  source: 'manual' | 'gpt' | 'other',
  timestamp: any
): Promise<TDoc> {
  const localizedUpdates = buildLocalizedUpdate(document, locale, updates, source, timestamp);

  const firestoreUpdates: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> = {
    ...localizedUpdates,
    updatedAt: timestamp,
  };

  await docRef.update(firestoreUpdates);

  // Build updated document state
  const updatedDoc: TDoc = { ...document };

  // Apply locale updates
  const locales = { ...(document.locales || {}) };
  const localeData = { ...(locales[locale] || {}) };

  for (const [field, value] of Object.entries(updates)) {
    if (value === undefined) continue;

    localeData[field] = value;
    localeData[`${field}$meta`] = {
      source,
      updatedAt: timestamp,
    };
  }

  locales[locale] = localeData;
  updatedDoc.locales = locales;
  (updatedDoc as any).updatedAt = timestamp;

  return updatedDoc;
}
