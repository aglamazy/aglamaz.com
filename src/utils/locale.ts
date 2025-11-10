export interface LocalePreference {
  tag: string;
  base: string;
  quality: number;
}

function parsePreference(segment: string): LocalePreference | null {
  const [tagPart, qPart] = segment.split(';');
  const rawTag = tagPart.trim();
  if (!rawTag) return null;

  const normalizedTag = rawTag.toLowerCase();
  const base = normalizedTag.split('-')[0];
  if (!base) return null;

  let quality = 1;
  if (qPart) {
    const [, qValue] = qPart.split('=');
    if (qValue) {
      const parsed = Number.parseFloat(qValue);
      if (!Number.isNaN(parsed)) {
        quality = Math.max(0, Math.min(1, parsed));
      }
    }
  }

  return {
    tag: normalizedTag,
    base,
    quality,
  };
}

export function parseAcceptLanguage(header: string | null | undefined): LocalePreference[] {
  if (!header) return [];
  const segments = header.split(',');
  const preferences: LocalePreference[] = [];

  for (const segment of segments) {
    const preference = parsePreference(segment);
    if (preference) {
      preferences.push(preference);
    }
  }

  return preferences.sort((a, b) => b.quality - a.quality);
}

export function sanitizeLocaleCandidate(
  candidate: string | null | undefined,
  supported: readonly string[],
): string | undefined {
  if (!candidate) return undefined;
  const normalized = candidate.toLowerCase();
  const base = normalized.split('-')[0];
  return supported.includes(base) ? base : undefined;
}

export function findBestSupportedLocale(
  preferences: LocalePreference[],
  supported: readonly string[],
): string | undefined {
  for (const preference of preferences) {
    if (supported.includes(preference.base)) {
      return preference.base;
    }
  }
  return undefined;
}

export function findBestMatchingTag(preferences: LocalePreference[], baseLocale: string): string | undefined {
  const normalizedBase = baseLocale.toLowerCase();
  const directMatch = preferences.find((preference) => preference.tag === normalizedBase);
  if (directMatch) {
    return directMatch.tag;
  }

  const baseMatch = preferences.find((preference) => preference.base === normalizedBase);
  return baseMatch?.tag;
}
