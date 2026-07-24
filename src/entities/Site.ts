export interface FieldMeta {
  source: 'manual' | 'gpt' | 'other';
  updatedAt: any;
}

// Define all translatable fields for a site
export const SITE_TRANSLATABLE_FIELDS = ['name', 'aboutFamily', 'platformName'] as const;
export type SiteTranslatableField = typeof SITE_TRANSLATABLE_FIELDS[number];

// Calendar systems a site can display events in. Extensible later (e.g. 'christian').
export const CALENDAR_SYSTEMS = ['gregorian', 'jewish', 'muslim'] as const;
export type CalendarSystem = typeof CALENDAR_SYSTEMS[number];

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

  // Flattened fields from current locale (for convenience)
  name?: string;
  aboutFamily?: string;
  platformName?: string;

  // Storage structure (for accessing other locales and metadata)
  locales?: Record<string, SiteLocaleContent>;

  // Calendar systems available on this site's event-creation form, and which
  // one is pre-selected. Unset means the site hasn't been configured yet
  // (older sites, or a backoffice creation flow that hasn't set it) - callers
  // must handle that explicitly rather than assuming a default.
  calendarSystems?: CalendarSystem[];
  defaultCalendarSystem?: CalendarSystem;
}
