import type { BlogPostLocalizedFields, IBlogPost } from '@/entities/BlogPost';

export interface AuthorInfo {
  name: string;
  handle: string;
  avatar: string;
  email?: string;
}

export interface BlogSchemaOptions {
  baseUrl?: string;
  siteName: string;
  lang: string;
}

function toIsoDate(value: unknown): string | undefined {
  if (!value) return undefined;
  if (typeof value === 'object' && typeof (value as any).toDate === 'function') {
    try {
      return (value as any).toDate().toISOString();
    } catch {
      return undefined;
    }
  }
  const date = new Date(String(value));
  if (Number.isNaN(date.getTime())) return undefined;
  return date.toISOString();
}

function toPlainText(html: string): string {
  return html
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findFirstImage(html: string): string | undefined {
  const match = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return match ? match[1] : undefined;
}

/**
 * Creates a BlogPosting schema for a single blog post
 */
export function createBlogPostingSchema(
  post: IBlogPost,
  localized: BlogPostLocalizedFields,
  author: AuthorInfo,
  options: BlogSchemaOptions
) {
  const { baseUrl, lang } = options;
  const content = localized.content || '';
  const summary = toPlainText(content).slice(0, 280);
  const articleUrlBase = baseUrl
    ? `${baseUrl}/${lang}/blog/${encodeURIComponent(author.handle)}`
    : `/${lang}/blog/${author.handle}`;
  const articleUrl = articleUrlBase;
  const image = findFirstImage(content);

  return {
    '@type': 'BlogPosting',
    '@id': baseUrl ? `${articleUrlBase}#post-${post.id}` : undefined,
    headline: localized.title,
    description: summary || undefined,
    url: articleUrl,
    datePublished: toIsoDate((post as any).createdAt ?? post.createdAt),
    dateModified: toIsoDate((post as any).updatedAt ?? post.updatedAt ?? (post as any).createdAt),
    isAccessibleForFree: true,
    mainEntityOfPage: articleUrl,
    wordCount: summary ? summary.split(/\s+/).length : undefined,
    image: image,
    inLanguage: localized.locale || post.primaryLocale || lang,
    author: {
      '@type': 'Person',
      name: author.name,
      url: articleUrl,
      image: author.avatar,
    },
    publisher: baseUrl ? { '@id': `${baseUrl}/#organization` } : undefined,
  };
}

/**
 * Creates a Blog schema for a blog index page
 */
export function createBlogSchema(
  description: string,
  options: BlogSchemaOptions
) {
  const { baseUrl, siteName, lang } = options;
  const blogUrl = baseUrl ? `${baseUrl}/${lang}/blog` : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'Blog',
    '@id': blogUrl ? `${blogUrl}#blog` : undefined,
    url: blogUrl,
    name: siteName,
    description,
    inLanguage: lang,
    publisher: baseUrl ? { '@id': `${baseUrl}/#organization` } : undefined,
  };
}

/**
 * Creates a ProfilePage schema for an author page
 */
export function createProfilePageSchema(
  author: AuthorInfo,
  options: BlogSchemaOptions
) {
  const { baseUrl, siteName, lang } = options;
  const authorUrl = baseUrl
    ? `${baseUrl}/${lang}/blog/${encodeURIComponent(author.handle)}`
    : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    name: siteName,
    inLanguage: lang,
    url: authorUrl,
    mainEntity: {
      '@type': 'Person',
      name: author.name,
      url: authorUrl,
      image: author.avatar,
    },
    publisher: baseUrl ? { '@id': `${baseUrl}/#organization` } : undefined,
  };
}

/**
 * Creates an ItemList schema containing blog posts
 */
export function createBlogPostListSchema(
  posts: IBlogPost[],
  localizedPosts: BlogPostLocalizedFields[],
  authors: AuthorInfo[],
  options: BlogSchemaOptions
) {
  const { baseUrl, lang } = options;
  const listUrl = baseUrl ? `${baseUrl}/${lang}/blog` : undefined;

  return {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    url: listUrl,
    numberOfItems: posts.length,
    itemListElement: posts.map((post, index) => {
      const author = authors[index];
      const localized = localizedPosts[index];
      const content = localized?.content || '';
      const summary = toPlainText(content).slice(0, 280);
      const articleUrlBase = baseUrl
        ? `${baseUrl}/${lang}/blog/${encodeURIComponent(author.handle)}`
        : `/${lang}/blog/${author.handle}`;
      const articleUrl = articleUrlBase;
      const image = findFirstImage(content);

      return {
        '@type': 'ListItem',
        position: index + 1,
        item: {
          '@type': 'BlogPosting',
          '@id': baseUrl ? `${articleUrlBase}#post-${post.id}` : undefined,
          headline: localized?.title ?? '',
          description: summary || undefined,
          url: articleUrl,
          datePublished: toIsoDate((post as any).createdAt ?? post.createdAt),
          dateModified: toIsoDate((post as any).updatedAt ?? post.updatedAt ?? (post as any).createdAt),
          isAccessibleForFree: true,
          mainEntityOfPage: articleUrl,
          wordCount: summary ? summary.split(/\s+/).length : undefined,
          image: image,
          inLanguage: localized?.locale || post.primaryLocale || lang,
          author: {
            '@type': 'Person',
            name: author.name,
            url: articleUrl,
            image: author.avatar,
          },
          publisher: baseUrl ? { '@id': `${baseUrl}/#organization` } : undefined,
        },
      };
    }),
  };
}
