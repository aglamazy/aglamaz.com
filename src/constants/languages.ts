export const LANGUAGES = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'he', label: 'עברית', flag: '🇮🇱' },
  { code: 'tr', label: 'Türkçe', flag: '🇹🇷' },
] as const;

export type LanguageCode = typeof LANGUAGES[number]['code'];
