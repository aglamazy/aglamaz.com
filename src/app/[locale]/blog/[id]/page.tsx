import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import { headers } from 'next/headers';
import TranslationTrigger from '@/components/blog/TranslationTrigger';
import I18nText from '@/components/I18nText';
import blogStyles from '@/components/blog/PublicPost.module.css';
import AuthorPostActions from '@/components/blog/AuthorPostActions';
import { stripScriptTags, cleanJsonLd } from '@/utils/jsonld';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getServerT } from '@/utils/serverTranslations';
import { getPlatformName } from '@/utils/platformName';
import { createProfilePageSchema, createBlogPostListSchema, type AuthorInfo } from '@/utils/blogSchema';
import UnderConstruction from '@/components/UnderConstruction';
import crypto from 'crypto';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import type { Metadata } from 'next';
import { buildTranslationTriggerPayload, localizeBlogPosts } from '@/utils/blogLocales';

export const dynamic = 'force-dynamic';

function resolveConfiguredBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return configured ? configured.replace(/\/+$/, '') : null;
}

async function resolveRequestBaseUrl() {
  const configured = resolveConfiguredBaseUrl();
  if (configured) {
    return configured;
  }

  try {
    const headerStore = await headers();
    const host = headerStore.get('host');
    if (!host) return null;
    const proto = headerStore.get('x-forwarded-proto') || 'https';
    return `${proto}://${host}`.replace(/\/+$/, '');
  } catch {
    return null;
  }
}

interface AuthorPageParams {
  locale: string;
  id: string;
}

export async function generateMetadata({ params }: { params: Promise<AuthorPageParams> }): Promise<Metadata> {
  const { locale: paramLocale, id } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  const baseUrl = resolveConfiguredBaseUrl();
  const canonical = baseUrl ? `${baseUrl}/${locale}/blog/${id}` : undefined;

  return {
    title: `Family Blog – ${id}`,
    alternates: baseUrl
      ? {
          canonical,
          languages: {
            en: `${baseUrl}/en/blog/${id}`,
            he: `${baseUrl}/he/blog/${id}`,
            'x-default': `${baseUrl}/en/blog/${id}`,
          },
        }
      : undefined,
  } satisfies Metadata;
}

export default async function AuthorBlogPage({ params }: { params: Promise<AuthorPageParams> }) {
  const { locale: paramLocale, id } = await params;
  const locale = SUPPORTED_LOCALES.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;

  const siteId = await resolveSiteId();
  if (!siteId) {
    const h = await headers();
    const host = h.get('host') || 'unknown';
    return <UnderConstruction domain={host} />;
  }

  const fam = new FamilyRepository();

  if (!id) {
    return <div>Invalid author handle</div>;
  }

  const member = await fam.getMemberByHandle(id, siteId);

  if (!member) {
    return <div>Author not found</div>;
  }

  const uid = (member as any)?.userId || (member as any)?.uid || '';
  const repo = new BlogRepository();
  const list = uid ? await repo.getByAuthor(uid) : [];
  const posts: IBlogPost[] = (list || [])
    .filter((p) => (p as any).siteId === siteId && p.isPublic)
    .sort((a, b) => {
      const at = (a.createdAt as any)?.toMillis ? (a.createdAt as any).toMillis() : new Date(a.createdAt).getTime();
      const bt = (b.createdAt as any)?.toMillis ? (b.createdAt as any).toMillis() : new Date(b.createdAt).getTime();
      return bt - at;
    });

  const baseLang = locale.split('-')[0]?.toLowerCase() || locale.toLowerCase();
  const t = await getServerT(baseLang);

  let siteInfo: Awaited<ReturnType<typeof fetchSiteInfo>> = null;
  try {
    siteInfo = await fetchSiteInfo(siteId, locale);
  } catch (error) {
    console.error('[blog/author] failed to fetch site info', error);
  }

  const localizedPosts = localizeBlogPosts(posts, { preferredLocale: locale, fallbackLocales: [DEFAULT_LOCALE] });

  const clientPosts = posts.map(buildTranslationTriggerPayload);

  const baseUrl = await resolveRequestBaseUrl() || undefined;
  const siteName = siteInfo?.name?.trim();

  const authorName =
    (member as any)?.displayName ||
    (member as any)?.firstName ||
    (member as any)?.email ||
    id;

  const authorEmail = (member as any)?.email || '';
  const hash = crypto.createHash('md5').update(authorEmail.trim().toLowerCase()).digest('hex');
  const authorAvatar = `https://www.gravatar.com/avatar/${hash}?s=48&d=identicon`;

  const author: AuthorInfo = {
    name: authorName,
    handle: id,
    avatar: authorAvatar,
    email: authorEmail,
  };

  const profileSchema = createProfilePageSchema(author, {
    baseUrl,
    siteName,
    lang: baseLang,
  });

  const postsListSchema = createBlogPostListSchema(
    localizedPosts.map(({ post }) => post),
    localizedPosts.map(({ localized }) => localized),
    localizedPosts.map(() => author),
    { baseUrl, siteName, lang: baseLang }
  );

  const structuredData = stripScriptTags(JSON.stringify([profileSchema, postsListSchema].map(cleanJsonLd)));

  return (
    <div className="space-y-4 p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <TranslationTrigger posts={clientPosts} lang={locale} />
      {localizedPosts.map(({ post, localized }) => (
        <Card key={post.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold text-charcoal m-0">{localized.title}</h1>
              <AuthorPostActions postId={post.id} authorId={post.authorId} />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`prose max-w-none ${blogStyles.content}`}
              dangerouslySetInnerHTML={{ __html: localized.content || '' }}
            />
          </CardContent>
        </Card>
      ))}
      {posts.length === 0 && (
        <div>
          <I18nText k="noPostsYet" />
        </div>
      )}
    </div>
  );
}
