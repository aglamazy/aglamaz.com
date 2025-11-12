export interface BlessingPage {
  id: string;
  eventId: string;      // Reference to anniversary event
  siteId: string;       // Site it belongs to
  year: number;         // Which year's occurrence (e.g., 2025)
  slug: string;         // URL slug (e.g., "abc123-2025")
  createdBy: string;    // User ID who created it
  createdAt: any;       // Firestore Timestamp
}
