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
import { createBlogSchema, createBlogPostingSchema, type AuthorInfo } from '@/utils/blogSchema';
import UnderConstruction from '@/components/UnderConstruction';
import { DEFAULT_LOCALE, SUPPORTED_LOCALES } from '@/i18n';
import type { Metadata } from 'next';
import { buildTranslationTriggerPayload, localizeBlogPosts } from '@/utils/blogLocales';

export const dynamic = 'force-dynamic';

const SUPPORTED = SUPPORTED_LOCALES.length ? SUPPORTED_LOCALES : ['en', 'he'];

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

interface FamilyBlogPageProps {
  params: Promise<{ locale: string }>;
}

export async function generateMetadata({ params }: FamilyBlogPageProps): Promise<Metadata> {
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
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
  const { locale: paramLocale } = await params;
  const locale = SUPPORTED.includes(paramLocale) ? paramLocale : DEFAULT_LOCALE;
  // Resolve site ID
  const siteId = await resolveSiteId();

  // If no site configured, show Under Construction
  if (!siteId) {
    const h = await headers();
    const host = h.get('host') || 'unknown';
    return <UnderConstruction domain={host} />;
  }

  const repo = new BlogRepository();
  const fam = new FamilyRepository();
  const posts: IBlogPost[] = await repo.getPublicBySite(siteId, 30);

  const h = await headers();
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

  const localizedPosts = localizeBlogPosts(posts, { preferredLocale: locale, fallbackLocales: [DEFAULT_LOCALE] });

  const enriched = await Promise.all(localizedPosts.map(async ({ post, localized }) => {
    const m = await fam.getMemberByUserId(post.authorId, siteId);
    const email = (m as any)?.email || '';
    const handle = (m as any)?.blogHandle || '';
    const name = (m as any)?.firstName || (m as any)?.displayName || email || 'Author';
    const hash = crypto.createHash('md5').update(email.trim().toLowerCase()).digest('hex');
    const avatar = `https://www.gravatar.com/avatar/${hash}?s=48&d=identicon`;
    const palette = ['bg-blue-50','bg-green-50','bg-yellow-50','bg-purple-50','bg-rose-50'];
    const colorIdx = parseInt(crypto.createHash('md5').update(String(post.id)).digest('hex').slice(0, 2), 16) % palette.length;
    const tint = palette[colorIdx];
    return { post, localized, name, handle, avatar, tint };
  }));

  // Minimal, plain-JSON payload for client TranslationTrigger
  const clientPosts = posts.map(buildTranslationTriggerPayload);

  const baseUrl = await resolveRequestBaseUrl() || undefined;
  const siteName = siteInfo?.name?.trim();

  const blogSchema = createBlogSchema(
    t('catchUpOnFamilyNews') as string,
    {
      baseUrl,
      siteName: `${siteName} – ${t('familyBlog') as string}`,
      lang: baseLang,
    }
  );

  const postSchemas = enriched.map(({ post, localized, name, handle, avatar }) => {
    const author: AuthorInfo = { name, handle, avatar };
    return createBlogPostingSchema(post, localized, author, { baseUrl, siteName, lang: baseLang });
  });

  const structuredData = stripScriptTags(JSON.stringify([blogSchema, ...postSchemas].map(cleanJsonLd)));

  return (
    <div className={`space-y-4 p-4 ${styles.blobBg}`}>
      <TranslationTrigger posts={clientPosts} lang={lang} />
      {/* For users with blogs: FAB to add post. For others: CTA to start a blog */}
      <AddPostFab />
      <BlogCTA />
      {enriched.map(({ post, localized, name, handle, avatar, tint }) => (
        <Card key={post.id} className="border-0 shadow-lg bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-3">
              <a href={`/${locale}/blog/${handle}`}>
                <img src={avatar} alt="" className="h-10 w-10 rounded-full" />
              </a>
              <div>
                <h1 className="text-2xl font-semibold text-charcoal m-0">{localized.title}</h1>
                <div className="text-xs text-gray-500">
                  <a className="hover:underline" href={`/${locale}/blog/${handle}`}>{name}</a>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`rounded-lg p-3 ${tint}`}>
              <div className={`text-sm text-gray-700 ${styles.clamp3} ${blogStyles.content}`} dangerouslySetInnerHTML={{ __html: localized.content || '' }} />
            </div>
            <div className="mt-2">
              <a className="text-blue-600 hover:underline text-sm" href={`/${locale}/blog/${handle}`}>
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
