/**
 * LocalizationService - Server-side functions
 * For client-safe functions, see LocalizationService.client.ts
 */

// Re-export all client-safe functions
export {
  type FieldMeta,
  type LocalizableDocument,
  normalizeLang,
  getLocalizedFields,
  getLocalizedDocument,
  hasLocale,
  isFieldStale,
  shouldRequestTranslation,
  getMostRecentFieldVersion,
  buildLocalizedUpdate,
} from './LocalizationService.client';

import type { LocalizableDocument } from './LocalizationService.client';
import { getMostRecentFieldVersion } from './LocalizationService.client';

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
  const { buildLocalizedUpdate } = await import('./LocalizationService.client');
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

/**
 * Ensures a document has content in the requested locale.
 * If content doesn't exist, translates it Just-In-Time from the most recent version.
 *
 * @param document - The document to ensure locale for
 * @param docRef - Firestore document reference
 * @param locale - Target locale
 * @param fields - Fields to ensure/translate
 * @param translateFn - Translation function (optional, uses TranslationService if not provided)
 * @returns Updated document with locale ensured
 */
export async function ensureLocale<TDoc extends LocalizableDocument & Record<string, any>>(
  document: TDoc,
  docRef: FirebaseFirestore.DocumentReference,
  locale: string,
  fields: string[],
  translateFn?: (text: string, from: string, to: string) => Promise<string | undefined>
): Promise<TDoc> {
  const { normalizeLang } = await import('./LocalizationService.client');
  const normalizedLocale = normalizeLang(locale);
  if (!normalizedLocale) {
    return document;
  }

  // Check if locale already has content for ALL requested fields
  const localeData = document.locales?.[locale];
  const hasAllFields = fields.every(field => localeData?.[field] !== undefined && localeData?.[field] !== null && localeData?.[field] !== '');

  if (hasAllFields) {
    // All content exists, no translation needed
    return document;
  }

  // Translation needed - find source content for missing fields
  const translatedFields: Record<string, any> = {};

  for (const field of fields) {
    // Skip if this field already exists
    if (localeData?.[field]) {
      continue;
    }

    // Find most recent version of this field
    const source = getMostRecentFieldVersion(document, field);
    if (!source || !source.value) {
      continue; // No source content to translate from
    }

    // Translate
    if (translateFn) {
      translatedFields[field] = await translateFn(source.value, source.locale, locale);
    } else {
      // Use default TranslationService
      const { TranslationService } = await import('./TranslationService');
      if (!TranslationService.isEnabled()) {
        throw new Error(`Translation service disabled, cannot translate to ${locale}`);
      }
      translatedFields[field] = await TranslationService.translateText({
        text: source.value,
        from: source.locale,
        to: locale,
      });
    }
  }

  // Save translated content if any fields were translated
  if (Object.keys(translatedFields).length > 0) {
    // Dynamic import to avoid pulling server-only code into client bundle
    const { Timestamp } = await import('firebase-admin/firestore');

    return await saveLocalizedContent(
      docRef,
      document,
      locale,
      translatedFields,
      'gpt',
      Timestamp.now()
    );
  }

  return document;
}
