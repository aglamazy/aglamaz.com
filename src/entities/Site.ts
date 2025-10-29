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

/**
 * ISite is the natural, convenient interface for working with sites.
 * It has flattened fields (name, aboutFamily, platformName) for the current locale.
 * The locales structure is also available for accessing other locales or metadata.
 */
export interface ISite {
  id: string;
  ownerUid: string;
  createdAt: any;
  updatedAt: any;

  // Flattened fields from current locale (for convenience)
  name?: string;
  aboutFamily?: string;
  platformName?: string;

  // Storage structure (for accessing other locales and metadata)
  locales?: Record<string, SiteLocaleContent>;
}
