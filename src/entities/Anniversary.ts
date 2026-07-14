import { LocalizableDocument } from '@/services/LocalizationService';

export type AnniversaryType = 'birthday' | 'death' | 'wedding' | 'other';

export interface AnniversaryEvent extends LocalizableDocument {
  id: string;
  siteId: string;
  ownerId: string;
  name: string;
  description?: string;
  type: AnniversaryType;
  burialDate?: string;
  date: any;
  month: number;
  day: number;
  year: number;
  // Present only on Hebrew events returned by getEventsForMonth for an occurrence
  // other than their own stored date - month/day/year/date above get overwritten
  // with the occurrence being displayed for the queried month, so callers that
  // need the true originally-entered date (e.g. the edit form) must use these
  // instead of month/day/year/date.
  originalDate?: any;
  originalMonth?: number;
  originalDay?: number;
  originalYear?: number;
  isAnnual: boolean;
  useHebrew?: boolean;
  deletedAt?: any;
  hebrewDate?: string; // Display like "ג' אלול תש"ל" (server formatted)
  hebrewKey?: string; // Matching key (e.g., "Elul 3")
  hebrewOccurrences?: Array<{
    year: number;
    month: number; // 0-11
    day: number;   // 1-31
    date: any;     // Firestore Timestamp
  }>;
  imageUrl?: string;
  createdAt: any;
  blessingPages?: Array<{
    year: number;
    slug: string;
  }>;
}
