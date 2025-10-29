import { Card, CardContent, CardHeader } from '@/components/ui/card';
import type { IBlogPost } from '@/entities/BlogPost';
import { BlogRepository } from '@/repositories/BlogRepository';
import { FamilyRepository } from '@/repositories/FamilyRepository';
import crypto from 'crypto';
import styles from './page.module.css';
import BlogCTA from '@/components/blog/BlogCTA';
import AddPostFab from '@/components/blog/AddPostFab';
import I18nText from '@/components/I18nText';
import TranslationTrigger from '@/components/blog/TranslationTrigger';
import { headers } from 'next/headers';
import blogStyles from '@/components/blog/PublicPost.module.css';
import { stripScriptTags, cleanJsonLd } from '@/utils/jsonld';
import { fetchSiteInfo } from '@/firebase/admin';
import { resolveSiteId } from '@/utils/resolveSiteId';
import { getServerT } from '@/utils/serverTranslations';
import { getPlatformName } from '@/utils/platformName';
import { createBlogSchema, createBlogPostingSchema, type AuthorInfo } from '@/utils/blogSchema';
import UnderConstruction from '@/components/UnderConstruction';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';

const SUPPORTED = SUPPORTED_LOCALES.length ? SUPPORTED_LOCALES : ['en', 'he'];

function resolveConfiguredBaseUrl() {
  const configured = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  return configured ? configured.replace(/\/+$/, '') : null;
}

function resolveRequestBaseUrl() {
  const configured = resolveConfiguredBaseUrl();
  if (configured) {
    return configured;
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

interface FamilyBlogPageProps {
  params: { locale: string };
}

export async function generateMetadata({ params }: FamilyBlogPageProps): Promise<Metadata> {
  const locale = SUPPORTED.includes(params.locale) ? params.locale : DEFAULT_LOCALE;
  const baseUrl = resolveConfiguredBaseUrl();
  const canonical = baseUrl ? `${baseUrl}/${locale}/blog` : undefined;

  return {
    title: 'Family Blog – Recent Posts',
    alternates: baseUrl
      ? {
          canonical,
          languages: {
            en: `${baseUrl}/en/blog`,
            he: `${baseUrl}/he/blog`,
            'x-default': `${baseUrl}/en/blog`,
          },
        }
      : undefined,
  } satisfies Metadata;
}

export default async function FamilyBlogPage({ params }: FamilyBlogPageProps) {
  const locale = SUPPORTED.includes(params.locale) ? params.locale : DEFAULT_LOCALE;
  // Resolve site ID
  const siteId = await resolveSiteId();

  // If no site configured, show Under Construction
  if (!siteId) {
    const h = headers();
    const host = h.get('host') || 'unknown';
    return <UnderConstruction domain={host} />;
  }

  const repo = new BlogRepository();
  const fam = new FamilyRepository();
  const posts: IBlogPost[] = await repo.getPublicBySite(siteId, 30);

  const h = headers();
  const lang = locale;
  const baseLang = lang.split('-')[0]?.toLowerCase() || lang.toLowerCase();
  const t = await getServerT(baseLang);

  let siteInfo: Awaited<ReturnType<typeof fetchSiteInfo>> = null;
  try {
    siteInfo = await fetchSiteInfo(siteId, locale);
  } catch (error) {
    console.error('[blog/family] failed to fetch site info', error);
    // Continue with null siteInfo
  }

  const choose = (p: IBlogPost) => {
    if (!lang || lang === p.sourceLang) return p;
    const translations = p.translations || {};
    const base = lang.split('-')[0]?.toLowerCase();
    let t = (translations as any)[lang] as any;
    if (!t && base) {
      const key = Object.keys(translations).find(k => {
        const kb = k.split('-')[0]?.toLowerCase();
        return k.toLowerCase() === lang.toLowerCase() || kb === base;
      });
      if (key) t = (translations as any)[key];
    }
    if (!t) return p;
    return { ...p, title: t.title || p.title, content: t.content || p.content };
  };

  const enriched = await Promise.all(posts.map(async (p) => {
    const m = await fam.getMemberByUserId(p.authorId, siteId);
    const email = (m as any)?.email || '';
    const handle = (m as any)?.blogHandle || '';
    const name = (m as any)?.firstName || (m as any)?.displayName || email || 'Author';
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    const avatar = `https://www.gravatar.com/avatar/${hash}?s=48&d=identicon`;
    const palette = ['bg-blue-50','bg-green-50','bg-yellow-50','bg-purple-50','bg-rose-50'];
    const colorIdx = parseInt(crypto.createHash('md5').update(String(p.id)).digest('hex').slice(0, 2), 16) % palette.length;
    const tint = palette[colorIdx];
    return { post: choose(p), name, handle, avatar, tint };
  }));

  // Minimal, plain-JSON payload for client TranslationTrigger
  const clientPosts = posts.map((p) => ({
    id: p.id,
    sourceLang: p.sourceLang,
    translations: Object.fromEntries(
      Object.entries(p.translations || {}).map(([k, v]: any) => [k, { title: String(v?.title || ''), content: String(v?.content || '') }])
    ) as Record<string, { title: string; content: string }>,
  }));

  const baseUrl = resolveRequestBaseUrl() || undefined;
  const siteName = siteInfo?.name?.trim() || getPlatformName(siteInfo);

  const blogSchema = createBlogSchema(
    t('catchUpOnFamilyNews') as string,
    {
      baseUrl,
      siteName: `${siteName} – ${t('familyBlog') as string}`,
      lang: baseLang,
    }
  );

  const postSchemas = posts.map((rawPost, index) => {
    const { post, name, handle, avatar } = enriched[index];
    const author: AuthorInfo = { name, handle, avatar };
    return createBlogPostingSchema(post, author, { baseUrl, siteName, lang: baseLang });
  });

  const structuredData = stripScriptTags(JSON.stringify([blogSchema, ...postSchemas].map(cleanJsonLd)));

  return (
    <div className={`space-y-4 p-4 ${styles.blobBg}`}>
      <TranslationTrigger posts={clientPosts} lang={lang} />
      {/* For users with blogs: FAB to add post. For others: CTA to start a blog */}
      <AddPostFab />
      <BlogCTA />
      {enriched.map(({ post, name, handle, avatar, tint }) => (
        <Card key={post.id} className="border-0 shadow-lg bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-3">
              <a href={`/${locale}/blog/author/${handle}`}>
                <img src={avatar} alt="" className="h-10 w-10 rounded-full" />
              </a>
              <div>
                <h1 className="text-2xl font-semibold text-charcoal m-0">{post.title}</h1>
                <div className="text-xs text-gray-500">
                  <a className="hover:underline" href={`/${locale}/blog/author/${handle}`}>{name}</a>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`rounded-lg p-3 ${tint}`}>
              <div className={`text-sm text-gray-700 ${styles.clamp3} ${blogStyles.content}`} dangerouslySetInnerHTML={{ __html: post.content || '' }} />
            </div>
            <div className="mt-2">
              <a className="text-blue-600 hover:underline text-sm" href={`/${locale}/blog/author/${handle}`}>
                <I18nText k="readMoreInBlog" options={{ name }} />
              </a>
            </div>
          </CardContent>
        </Card>
      ))}
      {posts.length === 0 && <div><I18nText k="noPublicPostsYet" /></div>}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: structuredData }} />
    </div>
  );
}
