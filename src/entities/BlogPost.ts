export type BlogPostLocaleEngine = 'gpt' | 'manual' | 'other';

export interface BlogPostLocaleFieldMeta {
  updatedAt: any;
  engine?: BlogPostLocaleEngine;
  sourceLocale?: string;
}

export interface BlogPostLocale {
  title?: string;
  title$meta?: BlogPostLocaleFieldMeta;
  content?: string;
  content$meta?: BlogPostLocaleFieldMeta;
  seoTitle?: string;
  seoTitle$meta?: BlogPostLocaleFieldMeta;
  seoDescription?: string;
  seoDescription$meta?: BlogPostLocaleFieldMeta;
}

export type BlogPostLocales = Record<string, BlogPostLocale>;

export interface BlogPostLocalizedFields {
  locale: string;
  title: string;
  content: string;
  seoTitle?: string;
  seoDescription?: string;
  fallbackChain: string[];
}

export interface LocalizedBlogPost {
  post: IBlogPost;
  localized: BlogPostLocalizedFields;
}

export interface BlogPostLocaleUpsertPayload {
  title?: string;
  content?: string;
  seoTitle?: string;
  seoDescription?: string;
  engine?: BlogPostLocaleEngine;
  sourceLocale?: string;
}

export interface BlogPostTranslationMeta {
  requested?: Record<string, any>; // lang -> Timestamp
  attempts?: number;
}

export type BlogPostStatus = 'draft' | 'in_review' | 'published';

export interface IBlogPost {
  id: string;
  authorId: string;
  siteId: string;
  primaryLocale: string;
  locales: BlogPostLocales;
  translationMeta?: BlogPostTranslationMeta;
  isPublic: boolean;
  /** Workflow status; absent on legacy posts → treat as 'published' */
  status?: BlogPostStatus;
  reviewToken?: string;
  reviewTokenExpiresAt?: any;
  reviewFeedback?: string;
  reviewDecision?: 'approved' | 'changes_requested';
  reviewDecidedAt?: any;
  likeCount?: number;
  shareCount?: number;
  taggedMemberIds?: string[]; // Member IDs tagged in this post
  deletedAt?: any; // Soft delete timestamp
  createdAt: any;
  updatedAt: any;
}
