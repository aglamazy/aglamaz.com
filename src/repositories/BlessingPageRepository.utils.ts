import type { AnniversaryType } from '@/entities/Anniversary';
import type { BlessingPage } from '@/entities/BlessingPage';

function toMillis(value: any): number {
  if (!value) {
    return 0;
  }
  if (typeof value.toMillis === 'function') {
    return value.toMillis();
  }
  if (typeof value.seconds === 'number') {
    const nanos = typeof value.nanoseconds === 'number' ? value.nanoseconds : 0;
    return value.seconds * 1000 + Math.floor(nanos / 1_000_000);
  }
  if (value instanceof Date) {
    return value.getTime();
  }
  return 0;
}

export function sortBlessingPages(pages: BlessingPage[]): BlessingPage[] {
  return [...pages].sort((left, right) => {
    const leftYear = typeof left.year === 'number' ? left.year : Number.NEGATIVE_INFINITY;
    const rightYear = typeof right.year === 'number' ? right.year : Number.NEGATIVE_INFINITY;

    if (leftYear !== rightYear) {
      return rightYear - leftYear;
    }

    const leftCreatedAt = toMillis(left.createdAt);
    const rightCreatedAt = toMillis(right.createdAt);
    if (leftCreatedAt !== rightCreatedAt) {
      return rightCreatedAt - leftCreatedAt;
    }

    return right.id.localeCompare(left.id);
  });
}

export function buildBlessingPageSlug(eventId: string, eventType: AnniversaryType, year?: number): string {
  if (eventType === 'death') {
    return eventId;
  }

  if (typeof year !== 'number') {
    throw new Error('Year is required for non-death blessing pages');
  }

  return `${eventId}-${year}`;
}

export function resolveCanonicalBlessingPage(
  pages: BlessingPage[],
  eventType: AnniversaryType,
  year?: number
): BlessingPage | null {
  if (eventType === 'death') {
    return sortBlessingPages(pages)[0] ?? null;
  }

  if (typeof year !== 'number') {
    return null;
  }

  return sortBlessingPages(pages).find((page) => page.year === year) ?? null;
}
