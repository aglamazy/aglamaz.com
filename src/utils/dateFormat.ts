/**
 * Gets the appropriate locale for date/time formatting.
 *
 * @param i18nLanguage - The i18n language setting (e.g., 'en', 'he', 'en-US')
 * @returns Locale string or array for toLocaleDateString/toLocaleString
 *
 * @remarks
 * When the i18n language is a base language (e.g., 'en' without a region),
 * this function uses the browser's locale preferences (navigator.languages)
 * to determine the format. This allows users to read content in one
 * language while seeing dates formatted according to their regional preferences.
 */
function getLocale(i18nLanguage: string): string | string[] {
  return i18nLanguage.includes('-')
    ? i18nLanguage
    : (typeof navigator !== 'undefined' ? Array.from(navigator.languages) : [i18nLanguage]);
}

/**
 * Firestore timestamp type (supports both formats)
 */
type FirestoreTimestamp = {
  seconds?: number;
  _seconds?: number;
};

/**
 * Formats a date using localized formatting.
 *
 * @param date - The date to format (Date object, ISO string, or Firestore timestamp)
 * @param i18nLanguage - The i18n language setting (e.g., 'en', 'he', 'en-US')
 * @returns Formatted date string
 *
 * @remarks
 * When the i18n language is a base language (e.g., 'en' without a region),
 * this function uses the browser's locale preferences (navigator.languages)
 * to determine the date format. This allows users to read content in one
 * language while seeing dates formatted according to their regional preferences.
 *
 * For example:
 * - User in Israel with browser set to 'en-IL' reading in English → d/m/y format
 * - User in US with browser set to 'en-US' reading in English → m/d/y format
 * - User reading in Hebrew ('he') → Hebrew date format regardless of browser settings
 */
export function formatLocalizedDate(
  date: Date | string | FirestoreTimestamp | null | undefined,
  i18nLanguage: string
): string {
  if (!date) return '';

  let dateObj: Date;

  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'object' && ('_seconds' in date || 'seconds' in date)) {
    const seconds = (date as FirestoreTimestamp)._seconds ?? (date as FirestoreTimestamp).seconds;
    if (!seconds) return '';
    dateObj = new Date(seconds * 1000);
  } else {
    return '';
  }

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  return dateObj.toLocaleDateString(getLocale(i18nLanguage));
}

/**
 * Formats a date and time using localized formatting.
 *
 * @param date - The date to format (Date object, ISO string, or Firestore timestamp)
 * @param i18nLanguage - The i18n language setting (e.g., 'en', 'he', 'en-US')
 * @returns Formatted date and time string
 *
 * @remarks
 * Similar to formatLocalizedDate but includes time component.
 * Uses browser's locale preferences when i18n language is a base language.
 * Accepts Date objects, ISO date strings, or Firestore timestamps.
 */
export function formatLocalizedDateTime(
  date: Date | string | FirestoreTimestamp | null | undefined,
  i18nLanguage: string
): string {
  if (!date) return '';

  let dateObj: Date;

  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'object' && ('_seconds' in date || 'seconds' in date)) {
    const seconds = (date as FirestoreTimestamp)._seconds ?? (date as FirestoreTimestamp).seconds;
    if (!seconds) return '';
    dateObj = new Date(seconds * 1000);
  } else {
    return '';
  }

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  return dateObj.toLocaleString(getLocale(i18nLanguage));
}

/**
 * Formats a date as relative time (e.g., "2 hours ago", "3 days ago")
 *
 * @param date - The date to format (Date object, ISO string, or Firestore timestamp)
 * @param i18nLanguage - The i18n language setting (e.g., 'en', 'he', 'en-US')
 * @returns Formatted relative time string
 *
 * @remarks
 * Uses Intl.RelativeTimeFormat for localized relative time formatting.
 * Falls back to absolute date if relative time formatting is not supported.
 */
export function formatRelativeTime(
  date: Date | string | FirestoreTimestamp | null | undefined,
  i18nLanguage: string
): string {
  if (!date) return '';

  let dateObj: Date;

  if (typeof date === 'string') {
    dateObj = new Date(date);
  } else if (date instanceof Date) {
    dateObj = date;
  } else if (typeof date === 'object' && ('_seconds' in date || 'seconds' in date)) {
    const seconds = (date as FirestoreTimestamp)._seconds ?? (date as FirestoreTimestamp).seconds;
    if (!seconds) return '';
    dateObj = new Date(seconds * 1000);
  } else {
    return '';
  }

  if (!(dateObj instanceof Date) || isNaN(dateObj.getTime())) {
    return '';
  }

  const now = new Date();
  const diffMs = now.getTime() - dateObj.getTime();
  const diffSeconds = Math.floor(diffMs / 1000);
  const diffMinutes = Math.floor(diffSeconds / 60);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);
  const diffWeeks = Math.floor(diffDays / 7);
  const diffMonths = Math.floor(diffDays / 30);
  const diffYears = Math.floor(diffDays / 365);

  try {
    const rtf = new Intl.RelativeTimeFormat(getLocale(i18nLanguage), { numeric: 'auto' });

    if (diffSeconds < 60) {
      return rtf.format(-diffSeconds, 'second');
    } else if (diffMinutes < 60) {
      return rtf.format(-diffMinutes, 'minute');
    } else if (diffHours < 24) {
      return rtf.format(-diffHours, 'hour');
    } else if (diffDays < 7) {
      return rtf.format(-diffDays, 'day');
    } else if (diffWeeks < 4) {
      return rtf.format(-diffWeeks, 'week');
    } else if (diffMonths < 12) {
      return rtf.format(-diffMonths, 'month');
    } else {
      return rtf.format(-diffYears, 'year');
    }
  } catch {
    // Fallback to absolute date if RelativeTimeFormat is not supported
    return formatLocalizedDate(dateObj, i18nLanguage);
  }
}
