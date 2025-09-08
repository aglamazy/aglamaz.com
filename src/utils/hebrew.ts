// Utilities to work with Hebrew calendar using Intl

export function formatHebrewDisplay(date: Date): string {
  try {
    const day = new Intl.DateTimeFormat('he-u-ca-hebrew', { day: 'numeric' }).format(date);
    const month = new Intl.DateTimeFormat('he-u-ca-hebrew', { month: 'long' }).format(date);
    const year = new Intl.DateTimeFormat('he-u-ca-hebrew', { year: 'numeric' }).format(date);
    // Normalize quotes
    return `${day} ${month} ${year}`;
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

