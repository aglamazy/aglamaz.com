import { CALENDAR_SYSTEMS, CalendarSystem } from '@/entities/Site';

export { CALENDAR_SYSTEMS };
export type { CalendarSystem };

/**
 * v1 heuristic for the DEFAULT calendarSystems a new site should get, based on
 * the family's country (ISO 3166-1 alpha-2). Only handles the one case we
 * actually know about today (Israel gets Hebrew-calendar support offered
 * alongside Gregorian); everything else starts Gregorian-only. This is
 * intentionally not a full country->calendars table - a family that wants a
 * different starting set (e.g. a Haredi site defaulting to Jewish-only) can
 * have it adjusted at creation time or changed afterward in site settings.
 *
 * Site creation itself happens outside this repo (see
 * docs/FAMILYCORE_SITE_CREATION.md) - this function is the source of truth
 * that flow should follow when populating calendarSystems/defaultCalendarSystem.
 */
export function inferDefaultCalendarSystems(countryCode?: string | null): {
  calendarSystems: CalendarSystem[];
  defaultCalendarSystem: CalendarSystem;
} {
  const normalized = countryCode?.trim().toUpperCase();

  if (normalized === 'IL') {
    return { calendarSystems: ['gregorian', 'jewish'], defaultCalendarSystem: 'gregorian' };
  }

  return { calendarSystems: ['gregorian'], defaultCalendarSystem: 'gregorian' };
}
