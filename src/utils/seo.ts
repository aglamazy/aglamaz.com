import { headers } from 'next/headers';
import type { Metadata } from 'next';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';

export function resolveConfiguredBaseUrl(): string | null {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return configured ? configured.replace(/\/+$/, '') : null;
}

/**
 * Resolves the absolute base URL for SEO metadata (canonical, hreflang, OG).
 *
 * This deployment is multi-tenant: one build serves many domains (famcircle.org,
 * <tenant>.famcircle.org, custom domains …) and the site is resolved from the
 * request host. NEXT_PUBLIC_APP_URL therefore cannot be baked to a single domain
 * in production, so canonical/hreflang metadata must be derived from the actual
 * request host. We prefer the request host and only fall back to the configured
 * env value when headers() is unavailable (e.g. a static rendering context).
 */
export async function resolveMetadataBaseUrl(): Promise<string | null> {
  try {
    const h = await headers();
    const host = h.get('host');
    if (host) {
      const isLocal = host.includes('localhost') || host.startsWith('127.0.0.1');
      const proto = h.get('x-forwarded-proto') || (isLocal ? 'http' : 'https');
      return `${proto}://${host}`.replace(/\/+$/, '');
    }
  } catch {
    // headers() not available in this context — fall through to configured value
  }
  return resolveConfiguredBaseUrl();
}

/** Normalizes a path fragment ('', 'blog', '/blog/agla') to a leading-slash suffix or ''. */
function pathSuffix(path = ''): string {
  const clean = path.replace(/^\/+|\/+$/g, '');
  return clean ? `/${clean}` : '';
}

/**
 * Turns arbitrary content (which may contain HTML markup or entities, e.g. a
 * site's rich-text "about" field) into a clean plain-text meta description.
 * Strips tags, decodes the handful of common entities, collapses whitespace and
 * caps the length so it renders well in search results and social cards.
 */
const META_DESCRIPTION_MAX = 160;
export function toPlainDescription(raw?: string): string | undefined {
  if (!raw) return undefined;
  const text = raw
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, ' ')
    .trim();
  if (!text) return undefined;
  return text.length > META_DESCRIPTION_MAX
    ? `${text.slice(0, META_DESCRIPTION_MAX - 1).trimEnd()}…`
    : text;
}

/**
 * Builds canonical + hreflang alternates for a localized path across every
 * supported locale, plus x-default. Returns undefined when no base URL is known.
 *
 * `canonicalLocale` lets a page point its canonical at a DIFFERENT locale than
 * the one it's rendering under (defaults to `locale`, i.e. self-referencing).
 * Used when the page's visible content is actually a fallback copy of another
 * locale (e.g. an untranslated blog post) - pointing canonical at the source
 * locale gives search engines the consolidation signal our own markup was
 * missing, instead of leaving it to guess (see buildPageMetadata callers).
 */
export function buildAlternates(
  baseUrl: string | null,
  locale: string,
  path = '',
  canonicalLocale: string = locale
): Metadata['alternates'] {
  if (!baseUrl) return undefined;
  const suffix = pathSuffix(path);
  const languages: Record<string, string> = {};
  for (const l of SUPPORTED_LOCALES) {
    languages[l] = `${baseUrl}/${l}${suffix}`;
  }
  languages['x-default'] = `${baseUrl}/${DEFAULT_LOCALE}${suffix}`;
  return {
    canonical: `${baseUrl}/${canonicalLocale}${suffix}`,
    languages,
  };
}

export interface PageMetaInput {
  locale: string;
  path?: string;
  title?: string;
  description?: string;
  siteName?: string;
  type?: 'website' | 'article' | 'profile';
  /** Overrides which locale's URL the canonical tag points at (see buildAlternates). */
  canonicalLocale?: string;
}

/**
 * Builds a complete, per-tenant Metadata object: title, description, canonical,
 * hreflang alternates (all locales + x-default), Open Graph and Twitter cards,
 * including og:image / twitter:image via the shared /og image route.
 */
export async function buildPageMetadata(input: PageMetaInput): Promise<Metadata> {
  const baseUrl = await resolveMetadataBaseUrl();
  const locale = SUPPORTED_LOCALES.includes(input.locale) ? input.locale : DEFAULT_LOCALE;
  const canonicalLocale =
    input.canonicalLocale && SUPPORTED_LOCALES.includes(input.canonicalLocale)
      ? input.canonicalLocale
      : locale;
  const path = input.path ?? '';
  const alternates = buildAlternates(baseUrl, locale, path, canonicalLocale);
  const canonicalUrl = alternates?.canonical as string | undefined;
  const description = toPlainDescription(input.description);
  const ogImage = baseUrl ? `${baseUrl}/og` : undefined;

  const meta: Metadata = {
    ...(input.title ? { title: input.title } : {}),
    ...(description ? { description } : {}),
    ...(baseUrl ? { metadataBase: new URL(baseUrl) } : {}),
    ...(alternates ? { alternates } : {}),
    robots: { index: true, follow: true },
    openGraph: {
      type: input.type || 'website',
      ...(canonicalUrl ? { url: canonicalUrl } : {}),
      ...(input.title ? { title: input.title } : {}),
      ...(description ? { description } : {}),
      ...(input.siteName ? { siteName: input.siteName } : {}),
      locale,
      ...(ogImage ? { images: [{ url: ogImage, width: 1200, height: 630 }] } : {}),
    },
    twitter: {
      card: 'summary_large_image',
      ...(input.title ? { title: input.title } : {}),
      ...(description ? { description } : {}),
      ...(ogImage ? { images: [ogImage] } : {}),
    },
  };
  return meta;
}
