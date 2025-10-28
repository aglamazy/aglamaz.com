export interface ISite {
  id: string;
  name: string;
  ownerUid: string;
  createdAt: any;
  updatedAt: any;
  sourceLang: string; // Language of original content
  translations?: Record<string, {
    name: string;
    aboutFamily: string;
    platformName: string;
    translatedAt: any;
    engine: 'gpt' | 'manual' | 'other';
  }>;
  translationMeta?: {
    requested?: Record<string, any>; // lang -> Timestamp
    attempts?: number;
  };
  aboutFamily?: string; // Family description in original language
  platformName?: string; // White-label platform name (defaults to "FamCircle")
}
