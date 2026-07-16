/**
 * Translates ephemeral digest content to a subscriber's locale.
 *
 * Digest content is per-send and not persisted, so we translate at send-time
 * via TranslationService.translateText rather than the ensureLocale/Firestore
 * pattern used for persisted entities (BlogPost, Blessing, Site).
 */

// Digest payload shape matching famcircle#20's compiled output
export interface DigestEvent {
  name: string;
  description?: string;
  type?: string;
  /** Pre-formatted Gregorian date string (e.g. "July 20, 2026") — skip translation */
  date?: string;
  /** Already in Hebrew — skip translation */
  hebrewDate?: string;
}

export interface DigestPhoto {
  /** Human-readable caption */
  caption?: string;
  /** Storage URL — skip translation */
  url?: string;
  /** Pre-formatted date string — skip translation */
  takenAt?: string;
}

export interface DigestPayload {
  events: DigestEvent[];
  photos: DigestPhoto[];
}

type TranslateFn = (text: string, from: string, to: string) => Promise<string | undefined>;

/**
 * Returns a new DigestPayload with user-facing text translated to targetLocale.
 *
 * Fields translated: event name, event description, photo caption.
 * Fields left as-is: event.hebrewDate (already localized), url, date, takenAt, type.
 *
 * @param payload - Compiled digest payload from famcircle#20
 * @param targetLocale - Subscriber's locale from Member.defaultLocale (e.g. 'he', 'en', 'tr')
 * @param opts.sourceLocale - Source locale of the compiled content (default: 'en')
 * @param opts.translateFn - Override translation function (inject in tests to avoid OpenAI calls)
 */
export async function translateDigestContent(
  payload: DigestPayload,
  targetLocale: string,
  opts?: {
    sourceLocale?: string;
    translateFn?: TranslateFn;
  }
): Promise<DigestPayload> {
  const sourceLocale = opts?.sourceLocale ?? 'en';

  if (targetLocale === sourceLocale) {
    return payload;
  }

  let translate: TranslateFn;
  if (opts?.translateFn) {
    translate = opts.translateFn;
  } else {
    // Dynamic import keeps firebase-admin out of the module graph until runtime
    const { TranslationService } = await import('./TranslationService');
    if (!TranslationService.isEnabled()) {
      throw new Error(`[DigestTranslationService] TranslationService disabled — OPENAI_API_KEY not set; cannot translate to ${targetLocale}`);
    }
    translate = (text, from, to) => TranslationService.translateText({ text, from, to });
  }

  async function translateField(value: string | undefined): Promise<string | undefined> {
    if (value === undefined || !value.trim()) return value;
    return translate(value, sourceLocale, targetLocale);
  }

  const events: DigestEvent[] = await Promise.all(
    payload.events.map(async (ev) => ({
      ...ev,
      name: (await translateField(ev.name)) ?? ev.name,
      description: ev.description !== undefined
        ? await translateField(ev.description)
        : undefined,
    }))
  );

  const photos: DigestPhoto[] = await Promise.all(
    payload.photos.map(async (ph) => ({
      ...ph,
      caption: ph.caption !== undefined
        ? await translateField(ph.caption)
        : undefined,
    }))
  );

  return { events, photos };
}
