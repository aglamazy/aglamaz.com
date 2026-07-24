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
  // Demo sites let anyone onboard with zero admin friction (see utils/siteUtils.shouldAutoApprove)
  isDemo?: boolean;

  // The site's configured primary language - explicit, admin-set (src/app/admin/site-settings),
  // never derived from content heuristics. Used as the fallback whenever a MEMBER has no
  // defaultLocale of their own (new signups, digest recipients, etc.) - NOT the same thing
  // as sourceLang (SiteRepository.getSettings), which is a per-field "most recently edited"
  // guess for the aboutFamily translation pipeline specifically and can legitimately point at
  // whichever locale a translator touched last (Agla, 2026-07-24 - the "Arabic digest"
  // incident: that exact heuristic silently promoted a stray locales.ar entry over the site's
  // real Hebrew content).
  defaultLocale?: string;

  // Flattened fields from current locale (for convenience)
  name?: string;
  aboutFamily?: string;
  platformName?: string;

  // Storage structure (for accessing other locales and metadata)
  locales?: Record<string, SiteLocaleContent>;
}
