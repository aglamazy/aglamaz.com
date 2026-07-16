import { TranslationService } from './TranslationService';
import { getLocalizedFields, getMostRecentFieldVersion } from './LocalizationService.client';
import type { DigestPayload } from './DigestCompilerService';
import type { AnniversaryEvent } from '@/entities/Anniversary';
import type { GalleryPhoto } from '@/repositories/GalleryPhotoRepository';

export interface TranslatedDigestPayload extends DigestPayload {
  events: Array<AnniversaryEvent & { name: string }>;
  photos: Array<GalleryPhoto & { description?: string }>;
}

/**
 * Translates digest content (event names and photo descriptions) to the target locale.
 *
 * Since digest payloads are ephemeral (per-send), this does NOT save to Firestore.
 * Instead, it translates content in-memory and returns the localized payload.
 *
 * @param payload - The compiled digest payload with events and photos
 * @param targetLocale - The target locale code (e.g., 'he', 'en')
 * @param translateFn - Optional translation function override for testing; defaults to TranslationService
 * @returns Promise<TranslatedDigestPayload> with translated event names and photo descriptions
 */
export async function translateDigestContent(
  payload: DigestPayload,
  targetLocale: string,
  translateFn?: (text: string, from: string, to: string) => Promise<string | undefined>
): Promise<TranslatedDigestPayload> {
  if (!targetLocale) {
    return payload as TranslatedDigestPayload;
  }

  // Translate event names
  const translatedEvents = await Promise.all(
    payload.events.map(async (event) => {
      // Try to get existing localized name first
      const localized = getLocalizedFields(event, targetLocale, ['name']);
      if (localized.name) {
        return { ...event, name: localized.name };
      }

      // If no localized name exists, translate from most recent version
      let sourceField = getMostRecentFieldVersion(event, 'name');
      if (!sourceField || !sourceField.value) {
        // Fallback to root name field
        const rootName = event.name?.trim();
        if (!rootName) {
          return event;
        }
        sourceField = { locale: 'en', value: rootName, updatedAt: event.createdAt };
      }

      try {
        const translatedName = translateFn
          ? await translateFn(sourceField.value, sourceField.locale || 'en', targetLocale)
          : await TranslationService.translateText({
              text: sourceField.value,
              from: sourceField.locale || 'en',
              to: targetLocale,
            });

        return { ...event, name: translatedName || event.name };
      } catch (error) {
        console.error(`[DigestTranslationService] Failed to translate event name "${event.name}":`, error);
        return event;
      }
    })
  );

  // Translate photo descriptions
  const translatedPhotos = await Promise.all(
    payload.photos.map(async (photo) => {
      // Try to get existing localized description first
      const localized = getLocalizedFields(photo, targetLocale, ['description']);
      if (localized.description) {
        return { ...photo, description: localized.description } as any;
      }

      // If no localized description exists, translate from most recent version
      const sourceField = getMostRecentFieldVersion(photo, 'description');
      if (!sourceField || !sourceField.value) {
        // No description found in any locale
        return { ...photo } as any;
      }

      try {
        const translatedDescription = translateFn
          ? await translateFn(sourceField.value, sourceField.locale || 'en', targetLocale)
          : await TranslationService.translateText({
              text: sourceField.value,
              from: sourceField.locale || 'en',
              to: targetLocale,
            });

        return { ...photo, description: translatedDescription || sourceField.value } as any;
      } catch (error) {
        console.error(`[DigestTranslationService] Failed to translate photo description:`, error);
        return { ...photo, description: sourceField.value } as any;
      }
    })
  );

  return {
    ...payload,
    events: translatedEvents,
    photos: translatedPhotos,
  } as TranslatedDigestPayload;
}
