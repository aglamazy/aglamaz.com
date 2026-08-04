import type { CalendarSystem } from '@/utils/calendarSystems';

export interface FieldMeta {
  source: 'manual' | 'gpt' | 'other';
  updatedAt: any;
}

// F7-A (famcircle#119): the ONE table every cron/send route reads before firing - rows
// are these 4 send types, columns are on/off (+ recipients, informational; locale
// reserved for later per Agla 2026-07-30, not built yet). No shadow config: the admin
// read/write API and every cron below resolve through SiteRepository.resolveSendSettings,
// never a separate flag.
export const SEND_TYPES = ['digest', 'inDayReminders', 'yahrzeitWhatsapp', 'blogAutogen'] as const;
export type SendType = typeof SEND_TYPES[number];

export interface SendTypeSetting {
  enabled: boolean;
}

export type SendSettings = Partial<Record<SendType, SendTypeSetting>>;

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

  // LEGACY per-site consent for the AI blog-autogen cron - superseded by
  // sendSettings.blogAutogen.enabled (F7-A, famcircle#119). Kept only as a fallback for
  // any site that had this set directly (via script) before the admin table existed;
  // SiteRepository.resolveSendSettings prefers sendSettings and falls back to this field
  // only when sendSettings.blogAutogen is absent. Do not read this field anywhere else.
  blogAutogenEnabled?: boolean;

  // F7-A (famcircle#119): the admin-controlled on/off table for every send type - the
  // SAME config every cron route reads before sending. See SendType/SendSettings above
  // and SiteRepository.resolveSendSettings/updateSendSetting.
  sendSettings?: SendSettings;

  // Flattened fields from current locale (for convenience)
  name?: string;
  aboutFamily?: string;
  platformName?: string;

  // Site-level calendar-system config (famcircle#113/#3167) - replaces the old
  // single-checkbox "use Hebrew calendar" toggle. calendarSystems is the set of
  // calendars this family's events can be entered in; defaultCalendarSystem is
  // pre-selected on new-event forms. Both optional - absent means "not configured
  // yet", callers fall back to inferDefaultCalendarSystems/getDefaultCalendarSystem.
  calendarSystems?: CalendarSystem[];
  defaultCalendarSystem?: CalendarSystem;

  // Storage structure (for accessing other locales and metadata)
  locales?: Record<string, SiteLocaleContent>;
}
