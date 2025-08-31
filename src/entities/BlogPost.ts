export interface IBlogPost {
  id: string;
  authorId: string;
  siteId: string;
  sourceLang: string;
  translations?: Record<string, {
    title: string;
    content: string;
    translatedAt: any;
    engine: 'gpt' | 'manual' | 'other';
  }>;
  translationMeta?: {
    requested?: Record<string, any>; // lang -> Timestamp
    attempts?: number;
  };
  title: string;
  content: string;
  isPublic: boolean;
  likeCount?: number;
  shareCount?: number;
  createdAt: any;
  updatedAt: any;
}
