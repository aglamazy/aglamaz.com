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
}
