export interface BlessingPage {
  id: string;
  eventId: string;      // Reference to anniversary event
  siteId: string;       // Site it belongs to
  year?: number;        // Annual pages only: which year's occurrence. Absent for standing (death) pages.
  slug: string;         // URL slug: "{eventId}-{year}" for annual, "{eventId}" for standing
  pageType?: 'annual' | 'standing'; // 'standing' = one durable memorial page per death event
  createdBy: string;    // User ID who created it
  createdAt: any;       // Firestore Timestamp
  // Reachable outside the family circle at /public/memorial/{slug} when true.
  // Missing field = false (back-compat for pages written before this field existed).
  isPublic?: boolean;
}
