import type {
  BlogPostLocale,
  BlogPostLocales,
  BlogPostLocalizedFields,
  IBlogPost,
  LocalizedBlogPost,
} from '@/entities/BlogPost';
import { DEFAULT_LOCALE } from '@/i18n';

function normalize(locale?: string | null): string | undefined {
  if (!locale) return undefined;
  return locale.toLowerCase();
}

function baseLocale(locale?: string | null): string | undefined {
  const normalized = normalize(locale);
  if (!normalized) return undefined;
  return normalized.split('-')[0] || normalized;
}

function getLocalesMap(post: IBlogPost): BlogPostLocales {
  return post.locales || {};
}

export function getAvailableLocales(post: IBlogPost): string[] {
  return Object.keys(getLocalesMap(post));
}

export function resolvePrimaryLocale(post: IBlogPost): string {
  const available = getAvailableLocales(post);
  const declared = normalize(post.primaryLocale);
  if (declared && available.includes(declared)) {
    return declared;
  }
  if (declared) {
    return declared;
  }
  return available[0] || DEFAULT_LOCALE;
}

function findLocaleMatch(locales: BlogPostLocales, target: string): string | undefined {
  if (locales[target]) return target;
  const targetBase = baseLocale(target);
  if (!targetBase) return undefined;
  return Object.keys(locales).find((locale) => baseLocale(locale) === targetBase);
}

function unique(values: (string | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const value of values) {
    if (!value) continue;
    const normalized = normalize(value);
    if (!normalized || seen.has(normalized)) continue;
    seen.add(normalized);
    result.push(normalized);
  }
  return result;
}

function materializeLocale(
  localeKey: string,
  entry: BlogPostLocale | undefined,
  fallbackChain: string[],
): BlogPostLocalizedFields {
  return {
    locale: localeKey,
    title: entry?.title || '',
    content: entry?.content || '',
    seoTitle: entry?.seoTitle,
    seoDescription: entry?.seoDescription,
    fallbackChain,
  };
}

export interface LocalizeOptions {
  preferredLocale?: string;
  fallbackLocales?: string[];
}

export function resolveLocalizedFields(
  post: IBlogPost,
  options: LocalizeOptions = {},
): BlogPostLocalizedFields {
  const locales = getLocalesMap(post);
  const availableKeys = Object.keys(locales);
  const primary = resolvePrimaryLocale(post);
  const preferred = normalize(options.preferredLocale);
  const fallbackLocales = options.fallbackLocales || [];
  const candidateChain = unique([
    preferred,
    ...fallbackLocales,
    primary,
    DEFAULT_LOCALE,
    ...availableKeys,
  ]);

  for (const candidate of candidateChain) {
    const match = candidate ? findLocaleMatch(locales, candidate) : undefined;
    if (match) {
      return materializeLocale(match, locales[match], candidateChain);
    }
  }

  // No locales stored; return empty shell bound to preferred or primary locale
  const fallbackLocale = preferred || primary || DEFAULT_LOCALE;
  return materializeLocale(fallbackLocale, undefined, candidateChain);
}

export function localizeBlogPost(
  post: IBlogPost,
  options: LocalizeOptions = {},
): LocalizedBlogPost {
  return {
    post,
    localized: resolveLocalizedFields(post, options),
  };
}

export function localizeBlogPosts(
  posts: IBlogPost[],
  options: LocalizeOptions = {},
): LocalizedBlogPost[] {
  return posts.map((post) => localizeBlogPost(post, options));
}

export interface TranslationTriggerPayload {
  id: string;
  primaryLocale: string;
  locales: Record<string, boolean>;
}

export function buildTranslationTriggerPayload(post: IBlogPost): TranslationTriggerPayload {
  const locales = getLocalesMap(post);
  const availability: Record<string, boolean> = {};
  for (const [key, value] of Object.entries(locales)) {
    availability[key] = Boolean(value?.title && value?.content);
  }
  return {
    id: post.id,
    primaryLocale: resolvePrimaryLocale(post),
    locales: availability,
  };
}

