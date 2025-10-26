export interface ISite {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: any;
  updatedAt: any;
  translations?: Record<string, string>; // Site name translations by locale
  aboutFamily?: string; // Family description in original language
  sourceLang?: string; // Language of original aboutFamily text
  aboutTranslations?: Record<string, string>; // Translated family descriptions by locale
  platformName?: string; // White-label platform name (defaults to "FamCircle")
}
