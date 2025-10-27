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

export const dynamic = 'force-dynamic';

function resolveBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (configured) {
    return configured.replace(/\/+$/, '');
  }

  try {
    const headerStore = headers();
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

export async function generateMetadata({ params }: { params: AuthorPageParams }): Promise<Metadata> {
  const locale = SUPPORTED_LOCALES.includes(params.locale) ? params.locale : DEFAULT_LOCALE;
  const baseUrl = resolveBaseUrl();
  const canonical = baseUrl ? `${baseUrl}/${locale}/blog/author/${params.id}` : undefined;

  return {
    title: `Family Blog – ${params.id}`,
    alternates: baseUrl
      ? {
          canonical,
          languages: {
            en: `${baseUrl}/en/blog/author/${params.id}`,
            he: `${baseUrl}/he/blog/author/${params.id}`,
            'x-default': `${baseUrl}/en/blog/author/${params.id}`,
          },
        }
      : undefined,
  } satisfies Metadata;
}

export default async function AuthorBlogPage({ params }: { params: AuthorPageParams }) {
  const locale = SUPPORTED_LOCALES.includes(params.locale) ? params.locale : DEFAULT_LOCALE;

  const siteId = await resolveSiteId();
  if (!siteId) {
    const h = headers();
    const host = h.get('host') || 'unknown';
    return <UnderConstruction domain={host} />;
  }

  const fam = new FamilyRepository();
  const member = await fam.getMemberByHandle(params.id, siteId);
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

  let siteInfo: Record<string, unknown> | null = null;
  try {
    siteInfo = (await fetchSiteInfo(siteId)) as Record<string, unknown> | null;
  } catch (error) {
    console.error('[blog/author] failed to fetch site info', error);
  }

  const choose = (p: IBlogPost) => {
    if (!locale || locale === p.sourceLang) return p;
    const translations = p.translations || {};
    const base = locale.split('-')[0]?.toLowerCase();
    let translated = translations[locale] as any;
    if (!translated && base) {
      const key = Object.keys(translations).find((k) => {
        const kb = k.split('-')[0]?.toLowerCase();
        return k.toLowerCase() === locale.toLowerCase() || kb === base;
      });
      if (key) translated = (translations as any)[key];
    }
    if (!translated) return p;
    return { ...p, title: translated.title || p.title, content: translated.content || p.content };
  };

  const localized = posts.map((p) => choose(p));

  const clientPosts = posts.map((p) => ({
    id: p.id,
    sourceLang: p.sourceLang,
    translations: Object.fromEntries(
      Object.entries(p.translations || {}).map(([k, v]: any) => [k, { title: String(v?.title || ''), content: String(v?.content || '') }])
    ) as Record<string, { title: string; content: string }>,
  }));

  const baseUrl = resolveBaseUrl() || undefined;
  const siteName =
    (siteInfo?.translations && typeof (siteInfo.translations as any)?.[baseLang] === 'string'
      ? String((siteInfo.translations as any)[baseLang])
      : typeof siteInfo?.name === 'string'
        ? String(siteInfo.name)
        : getPlatformName(siteInfo));

  const authorName =
    (member as any)?.displayName ||
    (member as any)?.firstName ||
    (member as any)?.email ||
    params.id;

  const authorEmail = (member as any)?.email || '';
  const hash = crypto.createHash('md5').update(authorEmail.trim().toLowerCase()).digest('hex');
  const authorAvatar = `https://www.gravatar.com/avatar/${hash}?s=48&d=identicon`;

  const author: AuthorInfo = {
    name: authorName,
    handle: params.id,
    avatar: authorAvatar,
    email: authorEmail,
  };

  const profileSchema = createProfilePageSchema(author, {
    baseUrl,
    siteName,
    lang: baseLang,
  });

  const postsListSchema = createBlogPostListSchema(
    localized,
    localized.map(() => author),
    { baseUrl, siteName, lang: baseLang }
  );

  const structuredData = stripScriptTags(JSON.stringify([profileSchema, postsListSchema].map(cleanJsonLd)));

  return (
    <div className="space-y-4 p-4">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
      <TranslationTrigger posts={clientPosts} lang={locale} />
      {localized.map((post) => (
        <Card key={post.id}>
          <CardHeader>
            <div className="flex items-start justify-between gap-3">
              <h1 className="text-2xl font-semibold text-charcoal m-0">{post.title}</h1>
              <AuthorPostActions postId={post.id} authorId={post.authorId} />
            </div>
          </CardHeader>
          <CardContent>
            <div
              className={`prose max-w-none ${blogStyles.content}`}
              dangerouslySetInnerHTML={{ __html: post.content || '' }}
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
