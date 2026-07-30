// Utilities to work with Hebrew calendar using Intl

// Greatest-value-first so the greedy conversion below always picks the largest letter
// that still fits, which is exactly how Hebrew numerals compose (e.g. 786 -> ת(400) +
// ש(300) + פ(80) + ו(6)).
const HEBREW_LETTER_VALUES: Array<[number, string]> = [
  [400, 'ת'], [300, 'ש'], [200, 'ר'], [100, 'ק'],
  [90, 'צ'], [80, 'פ'], [70, 'ע'], [60, 'ס'], [50, 'נ'], [40, 'מ'], [30, 'ל'], [20, 'כ'], [10, 'י'],
  [9, 'ט'], [8, 'ח'], [7, 'ז'], [6, 'ו'], [5, 'ה'], [4, 'ד'], [3, 'ג'], [2, 'ב'], [1, 'א'],
];

/**
 * Hebrew numeral (gematria) for 1-999. Node's bundled ICU does not support the `hebr`
 * numbering system for Intl.DateTimeFormat/NumberFormat (verified: silently falls back
 * to Western digits regardless of locale/extension requested) - real Hebrew letters
 * have to be composed manually, not left to Intl.
 */
function toHebrewNumeral(num: number): string {
  // 15 and 16 are written ט"ו / ט"ז, not יה / יו, which would visually resemble God's name.
  if (num === 15) return 'ט"ו';
  if (num === 16) return 'ט"ז';

  let remaining = num;
  let letters = '';
  for (const [value, letter] of HEBREW_LETTER_VALUES) {
    while (remaining >= value) {
      letters += letter;
      remaining -= value;
    }
  }
  if (letters.length <= 1) return `${letters}'`;
  return `${letters.slice(0, -1)}"${letters.slice(-1)}`;
}

/** Real Hebrew day/year numerals (e.g. "ט"ז אלול תשע"ו"), not Arabic digits - see toHebrewNumeral. */
export function formatHebrewDisplay(date: Date): string {
  try {
    const day = Number(new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' }).format(date));
    const month = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' }).format(date);
    const year = Number(new Intl.DateTimeFormat('en-u-ca-hebrew', { year: 'numeric' }).format(date));
    // Hebrew calendar years are conventionally written without the thousands digit
    // (5786 -> תשפ"ו, not a 4-digit-equivalent form).
    return `${toHebrewNumeral(day)} ${month} ${toHebrewNumeral(year % 1000)}`;
  } catch {
    return '';
  }
}

// A stable key for matching: English transliteration month + Arabic numeral day
export function formatHebrewKey(date: Date): string {
  try {
    const day = new Intl.DateTimeFormat('en-u-ca-hebrew', { day: 'numeric' }).format(date);
    const month = new Intl.DateTimeFormat('en-u-ca-hebrew', { month: 'long' }).format(date);
    return `${month} ${day}`; // e.g., "Elul 3"
  } catch {
    return '';
  }
}

// Find Gregorian date in the given Gregorian year that matches the Hebrew month/day key
export function findGregorianForHebrewKeyInYear(hebKey: string, gregorianYear: number): Date | null {
  if (!hebKey) return null;
  try {
    const start = new Date(gregorianYear, 0, 1);
    const end = new Date(gregorianYear, 11, 31);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
      const key = formatHebrewKey(d);
      if (key === hebKey) {
        return new Date(d);
      }
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Resolves the display occurrence (month/day/year) of a Hebrew-tracked annual event for a
 * queried (month, year), recomputed fresh from hebrewKey every call - deliberately does NOT
 * consult any precomputed/cached occurrence table. A cache (e.g. AnniversaryEvent's
 * hebrewOccurrences) can go stale (written by a since-fixed algorithm, hand-edited data,
 * a missed recompute on save, ...) and silently misfire "today" reminders on the wrong day
 * with nothing in the read path to catch it (famcircle#120: 6-day-early birthday misfire).
 * Recomputing from hebrewKey - the source of truth for which Hebrew calendar day the event
 * falls on - closes that whole bug class instead of trusting a derived value.
 */
export function resolveHebrewOccurrenceForMonth(
  ev: { month: number; year: number; day: number; hebrewKey?: string },
  month: number,
  year: number,
): { month: number; day: number; year: number } | null {
  // The originally-entered occurrence is already correct for its own creation year - no
  // Hebrew/Gregorian conversion needed or possible (hebrewKey maps a Hebrew day to *a*
  // Gregorian year, not back to the exact date the event was created with).
  if (ev.month === month && ev.year === year) {
    return { month: ev.month, day: ev.day, year: ev.year };
  }
  if (!ev.hebrewKey) return null;
  const g = findGregorianForHebrewKeyInYear(ev.hebrewKey, year);
  if (!g || g.getMonth() !== month) return null;
  return { month: g.getMonth(), day: g.getDate(), year };
}

