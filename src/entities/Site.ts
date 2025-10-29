export interface FieldMeta {
  source: 'manual' | 'gpt' | 'other';
  updatedAt: any;
}

// Define all translatable fields for a site
export const SITE_TRANSLATABLE_FIELDS = ['name', 'aboutFamily', 'platformName'] as const;
export type SiteTranslatableField = typeof SITE_TRANSLATABLE_FIELDS[number];

export interface SiteLocaleContent {
  // Site name
  name?: string;
  name$meta?: FieldMeta;

  // Family description
  aboutFamily?: string;
  aboutFamily$meta?: FieldMeta;

  // White-label platform name (defaults to "FamCircle")
  platformName?: string;
  platformName$meta?: FieldMeta;
}

export interface ISite {
  id: string;
  ownerUid: string;
  createdAt: any;
  updatedAt: any;
  locales: Record<string, SiteLocaleContent>; // locale code -> content with metadata
}
