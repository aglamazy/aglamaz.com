/**
 * Maps IANA timezone names to ISO 3166-1 alpha-2 country codes.
 *
 * Used to derive a date formatting locale from the user's timezone.
 * Source: IANA timezone database zone.tab
 */

const TIMEZONE_TO_REGION: Record<string, string> = {
  // Africa
  'Africa/Abidjan': 'CI',
  'Africa/Accra': 'GH',
  'Africa/Addis_Ababa': 'ET',
  'Africa/Algiers': 'DZ',
  'Africa/Cairo': 'EG',
  'Africa/Casablanca': 'MA',
  'Africa/Dar_es_Salaam': 'TZ',
  'Africa/Johannesburg': 'ZA',
  'Africa/Lagos': 'NG',
  'Africa/Nairobi': 'KE',
  'Africa/Tunis': 'TN',

  // America
  'America/Anchorage': 'US',
  'America/Argentina/Buenos_Aires': 'AR',
  'America/Bogota': 'CO',
  'America/Chicago': 'US',
  'America/Denver': 'US',
  'America/Detroit': 'US',
  'America/Edmonton': 'CA',
  'America/Halifax': 'CA',
  'America/Havana': 'CU',
  'America/Indiana/Indianapolis': 'US',
  'America/Lima': 'PE',
  'America/Los_Angeles': 'US',
  'America/Manaus': 'BR',
  'America/Mexico_City': 'MX',
  'America/Montreal': 'CA',
  'America/New_York': 'US',
  'America/Panama': 'PA',
  'America/Phoenix': 'US',
  'America/Santiago': 'CL',
  'America/Sao_Paulo': 'BR',
  'America/St_Johns': 'CA',
  'America/Toronto': 'CA',
  'America/Vancouver': 'CA',
  'America/Winnipeg': 'CA',

  // Asia
  'Asia/Almaty': 'KZ',
  'Asia/Amman': 'JO',
  'Asia/Baghdad': 'IQ',
  'Asia/Baku': 'AZ',
  'Asia/Bangkok': 'TH',
  'Asia/Beirut': 'LB',
  'Asia/Calcutta': 'IN',
  'Asia/Colombo': 'LK',
  'Asia/Damascus': 'SY',
  'Asia/Dhaka': 'BD',
  'Asia/Dubai': 'AE',
  'Asia/Ho_Chi_Minh': 'VN',
  'Asia/Hong_Kong': 'HK',
  'Asia/Istanbul': 'TR',
  'Asia/Jakarta': 'ID',
  'Asia/Jerusalem': 'IL',
  'Asia/Kabul': 'AF',
  'Asia/Karachi': 'PK',
  'Asia/Kathmandu': 'NP',
  'Asia/Kolkata': 'IN',
  'Asia/Kuala_Lumpur': 'MY',
  'Asia/Kuwait': 'KW',
  'Asia/Manila': 'PH',
  'Asia/Muscat': 'OM',
  'Asia/Nicosia': 'CY',
  'Asia/Novosibirsk': 'RU',
  'Asia/Qatar': 'QA',
  'Asia/Riyadh': 'SA',
  'Asia/Seoul': 'KR',
  'Asia/Shanghai': 'CN',
  'Asia/Singapore': 'SG',
  'Asia/Taipei': 'TW',
  'Asia/Tashkent': 'UZ',
  'Asia/Tbilisi': 'GE',
  'Asia/Tehran': 'IR',
  'Asia/Tel_Aviv': 'IL',
  'Asia/Tokyo': 'JP',
  'Asia/Ulaanbaatar': 'MN',
  'Asia/Yekaterinburg': 'RU',
  'Asia/Yerevan': 'AM',

  // Atlantic
  'Atlantic/Reykjavik': 'IS',

  // Australia
  'Australia/Adelaide': 'AU',
  'Australia/Brisbane': 'AU',
  'Australia/Darwin': 'AU',
  'Australia/Hobart': 'AU',
  'Australia/Melbourne': 'AU',
  'Australia/Perth': 'AU',
  'Australia/Sydney': 'AU',

  // Europe
  'Europe/Amsterdam': 'NL',
  'Europe/Athens': 'GR',
  'Europe/Belgrade': 'RS',
  'Europe/Berlin': 'DE',
  'Europe/Bratislava': 'SK',
  'Europe/Brussels': 'BE',
  'Europe/Bucharest': 'RO',
  'Europe/Budapest': 'HU',
  'Europe/Copenhagen': 'DK',
  'Europe/Dublin': 'IE',
  'Europe/Helsinki': 'FI',
  'Europe/Istanbul': 'TR',
  'Europe/Kiev': 'UA',
  'Europe/Kyiv': 'UA',
  'Europe/Lisbon': 'PT',
  'Europe/Ljubljana': 'SI',
  'Europe/London': 'GB',
  'Europe/Luxembourg': 'LU',
  'Europe/Madrid': 'ES',
  'Europe/Minsk': 'BY',
  'Europe/Moscow': 'RU',
  'Europe/Oslo': 'NO',
  'Europe/Paris': 'FR',
  'Europe/Prague': 'CZ',
  'Europe/Riga': 'LV',
  'Europe/Rome': 'IT',
  'Europe/Sofia': 'BG',
  'Europe/Stockholm': 'SE',
  'Europe/Tallinn': 'EE',
  'Europe/Vilnius': 'LT',
  'Europe/Vienna': 'AT',
  'Europe/Warsaw': 'PL',
  'Europe/Zagreb': 'HR',
  'Europe/Zurich': 'CH',

  // Indian
  'Indian/Maldives': 'MV',
  'Indian/Mauritius': 'MU',

  // Pacific
  'Pacific/Auckland': 'NZ',
  'Pacific/Fiji': 'FJ',
  'Pacific/Guam': 'GU',
  'Pacific/Honolulu': 'US',
};

/**
 * Returns the ISO 3166-1 country code for a given IANA timezone string.
 * Returns undefined if the timezone is not in our mapping.
 */
export function timezoneToRegion(tz: string): string | undefined {
  return TIMEZONE_TO_REGION[tz];
}

/**
 * Resolves a full locale for date formatting by combining a page language
 * with a region derived from a timezone string.
 *
 * Examples:
 *   resolveDateLocale('he', 'Asia/Jerusalem') → 'he-IL'
 *   resolveDateLocale('en', 'Asia/Jerusalem') → 'en-IL'
 *   resolveDateLocale('en', 'America/New_York') → 'en-US'
 *
 * Falls back to the page language alone if timezone is missing or unmapped.
 */
export function resolveDateLocale(pageLanguage: string, timezone?: string | null): string {
  if (pageLanguage.includes('-')) {
    return pageLanguage;
  }

  if (timezone) {
    const region = timezoneToRegion(timezone);
    if (region) {
      return `${pageLanguage}-${region}`;
    }
  }

  return pageLanguage;
}
