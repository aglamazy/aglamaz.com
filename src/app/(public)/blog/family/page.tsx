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
import { getServerT } from '@/utils/serverTranslations';
import { createBlogSchema, createBlogPostingSchema, type AuthorInfo } from '@/utils/blogSchema';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Family Blog – Recent Posts',
};

function resolveBaseUrl() {
  const raw = (process.env.NEXT_PUBLIC_APP_URL || '').trim();
  if (!raw) return null;
  return raw.replace(/\/+$/, '');
}

export default async function FamilyBlogPage({ searchParams }: { searchParams?: Record<string, string | string[] | undefined> }) {
  const siteId = process.env.NEXT_SITE_ID || '';
  const repo = new BlogRepository();
  const fam = new FamilyRepository();
  const posts: IBlogPost[] = await repo.getPublicBySite(siteId, 30);

  const h = headers();
  const accept = h.get('accept-language') || '';
  const qp = (searchParams?.lang as string | undefined)?.toString();
  const lang = (qp && qp.split('-')[0]) || accept.split(',')[0]?.split('-')[0] || process.env.NEXT_DEFAULT_LANG || 'en';
  const baseLang = lang.split('-')[0]?.toLowerCase() || lang.toLowerCase();
  const t = await getServerT(baseLang);

  let siteInfo: Record<string, unknown> | null = null;
  try {
    siteInfo = (await fetchSiteInfo()) as Record<string, unknown> | null;
  } catch (error) {
    console.error('[blog/family] failed to fetch site info', error);
    throw error;
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

  const baseUrl = resolveBaseUrl() || undefined;
  const siteName =
    (siteInfo?.translations && typeof (siteInfo.translations as any)?.[baseLang] === 'string'
      ? String((siteInfo.translations as any)[baseLang])
      : typeof siteInfo?.name === 'string'
        ? String(siteInfo.name)
        : 'FamilyCircle');

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
      <script
        id="__INITIAL_LANG__"
        dangerouslySetInnerHTML={{ __html: `window.__INITIAL_LANG__=${JSON.stringify(baseLang)};` }}
      />
      <TranslationTrigger posts={clientPosts} lang={lang} />
      {/* For users with blogs: FAB to add post. For others: CTA to start a blog */}
      <AddPostFab />
      <BlogCTA />
      {enriched.map(({ post, name, handle, avatar, tint }) => (
        <Card key={post.id} className="border-0 shadow-lg bg-white/90">
          <CardHeader>
            <div className="flex items-center gap-3">
              <a href={`/blog/author/${handle}?lang=${lang}`}>
                <img src={avatar} alt="" className="h-10 w-10 rounded-full" />
              </a>
              <div>
                <h1 className="text-2xl font-semibold text-charcoal m-0">{post.title}</h1>
                <div className="text-xs text-gray-500">
                  <a className="hover:underline" href={`/blog/author/${handle}?lang=${lang}`}>{name}</a>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className={`rounded-lg p-3 ${tint}`}>
              <div className={`text-sm text-gray-700 ${styles.clamp3} ${blogStyles.content}`} dangerouslySetInnerHTML={{ __html: post.content || '' }} />
            </div>
            <div className="mt-2">
              <a className="text-blue-600 hover:underline text-sm" href={`/blog/author/${handle}?lang=${lang}`}>
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
