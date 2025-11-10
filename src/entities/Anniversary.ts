export interface AnniversaryEvent {
  id: string;
  siteId: string;
  ownerId: string;
  name: string;
  description?: string;
  type: 'birthday' | 'death' | 'death_anniversary' | 'wedding';
  date: any;
  month: number;
  day: number;
  year: number;
  isAnnual: boolean;
  useHebrew?: boolean;
  hebrewDate?: string; // Display like "ג' אלול תש"ל" (server formatted)
  hebrewKey?: string; // Matching key (e.g., "Elul 3")
  hebrewBurialDate?: string;
  hebrewBurialKey?: string;
  hebrewOccurrences?: Array<{
    year: number;
    month: number; // 0-11
    day: number;   // 1-31
    date: any;     // Firestore Timestamp
  }>;
  deathDate?: any;
  burialDate?: any;
  originalDate?: any;
  imageUrl?: string;
  createdAt: any;
}
