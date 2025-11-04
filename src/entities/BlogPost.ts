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

export interface IBlogPost {
  id: string;
  authorId: string;
  siteId: string;
  primaryLocale: string;
  locales: BlogPostLocales;
  translationMeta?: BlogPostTranslationMeta;
  isPublic: boolean;
  likeCount?: number;
  shareCount?: number;
  deletedAt?: any; // Soft delete timestamp
  createdAt: any;
  updatedAt: any;
}
