import { LocalizableDocument } from '@/services/LocalizationService';

export interface Blessing extends LocalizableDocument {
  id: string;
  blessingPageId: string;  // Reference to blessing page
  siteId: string;          // For querying by site
  authorId: string;        // User who wrote it
  authorName: string;      // Cached name for display
  content: string;         // Rich text HTML from TinyMCE
  createdAt: any;          // Firestore Timestamp
  updatedAt: any;          // Firestore Timestamp
  deleted: boolean;        // Soft delete
  deletedAt?: any;         // Firestore Timestamp
  taggedMemberIds?: string[]; // Member IDs tagged in this blessing
  visibleToPublic: boolean; // Whether this specific memory may show on the public (non-member) memorial page. Default false.
  isNonMemberContribution: boolean; // True when authored by an anonymous visitor via the public memorial page, not a signed-in member. Default false.
  guestEmail?: string; // Optional contact email for a non-member contributor (moderation/follow-up only; never rendered to other visitors).
}
