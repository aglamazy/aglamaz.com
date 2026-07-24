export const CALENDAR_SYSTEMS = ['gregorian', 'jewish', 'muslim'] as const;

export type CalendarSystem = (typeof CALENDAR_SYSTEMS)[number];

const CALENDAR_SYSTEM_SET = new Set<string>(CALENDAR_SYSTEMS);

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function containsAny(text: string, needles: string[]): boolean {
  return needles.some((needle) => text.includes(needle));
}

export function isCalendarSystem(value: unknown): value is CalendarSystem {
  return typeof value === 'string' && CALENDAR_SYSTEM_SET.has(value);
}

export function normalizeCalendarSystems(values: unknown): CalendarSystem[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const normalized: CalendarSystem[] = [];
  const seen = new Set<CalendarSystem>();

  for (const value of values) {
    if (!isCalendarSystem(value) || seen.has(value)) {
      continue;
    }
    seen.add(value);
    normalized.push(value);
  }

  return normalized;
}

export function inferDefaultCalendarSystems(params: {
  country?: string | null;
  name?: string | null;
  timezone?: string | null;
}): CalendarSystem[] {
  const country = normalizeText(params.country);
  const name = normalizeText(params.name);
  const timezone = normalizeText(params.timezone);

  if (country === 'il' || timezone.includes('asia/jerusalem') || timezone.includes('asia/tel_aviv')) {
    if (
      containsAny(name, ['חרדי', 'חסידי', 'haredi', 'hasid', 'chassid', 'ultra orthodox', 'orthodox'])
    ) {
      return ['jewish'];
    }

    return ['gregorian', 'jewish'];
  }

  if (containsAny(name, ['muslim', 'islam', 'ramadan', 'eid'])) {
    return ['gregorian', 'muslim'];
  }

  return ['gregorian'];
}

export function getDefaultCalendarSystem(calendarSystems: CalendarSystem[]): CalendarSystem | null {
  return calendarSystems[0] ?? null;
}
