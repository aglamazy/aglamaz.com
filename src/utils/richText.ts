export type RichTextFields = { title: string; content: string };
export type RichTextDoc = { locales: Record<string, RichTextFields> } & RichTextFields;

export interface LocalizedRichText {
  content: string;
  title: string;
  translations: Record<string, { title: string; content: string }>;
}

/** Converts a Firestore rich-text doc (title/content + per-locale translations) into a LocalizableDocument for getLocalizedDocument(). */
export function toRichTextDoc(
  input: LocalizedRichText | null | undefined,
  sourceLang: string
): RichTextDoc | null {
  if (!input) return null;

  const locales: Record<string, RichTextFields> = {};

  locales[sourceLang] = {
    title: input.title ?? '',
    content: input.content ?? '',
  };

  for (const [locale, value] of Object.entries(input.translations ?? {})) {
    locales[locale] = {
      title: value?.title ?? '',
      content: value?.content ?? '',
    };
  }

  return {
    title: input.title ?? '',
    content: input.content ?? '',
    locales,
  };
}
