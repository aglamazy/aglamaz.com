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
  // Carried through from the parent post so render sites can pick md→html vs raw-html.
  contentFormat?: BlogPostContentFormat;
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

export type BlogPostContentFormat = 'md' | 'html';

// Draft-review workflow status. Missing status = 'published' (back-compat for
// posts written before this field existed) - always gate through isPublished()
// from utils/blogStatus rather than comparing status inline.
export type BlogPostStatus = 'draft' | 'in_review' | 'published';

export type BlogPostReviewDecision = 'approved' | 'changes_requested';

export interface IBlogPost {
  id: string;
  authorId: string;
  siteId: string;
  primaryLocale: string;
  locales: BlogPostLocales;
  translationMeta?: BlogPostTranslationMeta;
  isPublic: boolean;
  // Content format applies to ALL locales (per-post, not per-locale). Authoring
  // happens once in the primary locale; translations preserve the same format.
  // Missing field = 'html' (back-compat for posts written before this field existed).
  contentFormat?: BlogPostContentFormat;
  // Draft-review workflow. isPublic is an orthogonal audience choice the author
  // sets independently - approving a review flips status only, never isPublic.
  status?: BlogPostStatus;
  reviewToken?: string;
  reviewTokenExpiresAt?: any;
  reviewFeedback?: string;
  reviewDecision?: BlogPostReviewDecision;
  reviewDecidedAt?: any;
  likeCount?: number;
  shareCount?: number;
  deletedAt?: any; // Soft delete timestamp
  createdAt: any;
  updatedAt: any;
}
